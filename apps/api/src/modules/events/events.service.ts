import { Injectable } from '@nestjs/common';
import { Prisma, ReadingEventType } from '@prisma/client';

import type { EventBatchResponse, RejectedEvent } from '@news-tracker/contracts';
import { readingEventSchema, type ValidatedReadingEvent } from '@news-tracker/validation';

import { PrismaService } from '../../prisma/prisma.service';
import { ArticlesService } from '../articles/articles.service';
import { SessionEventError, SessionsService } from '../sessions/sessions.service';

type ProcessingResult = 'accepted' | 'duplicated';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly articlesService: ArticlesService,
    private readonly sessionsService: SessionsService,
  ) {}

  async ingestBatch(inputs: unknown[]): Promise<EventBatchResponse> {
    const response: EventBatchResponse = { accepted: [], duplicated: [], rejected: [] };

    for (const input of inputs) {
      const parsed = readingEventSchema.safeParse(input);
      if (!parsed.success) {
        response.rejected.push({
          eventId: this.getCandidateEventId(input),
          reasons: parsed.error.issues.map((issue) => {
            const path = issue.path.length === 0 ? 'event' : issue.path.join('.');
            return `${path}: ${issue.message}`;
          }),
        });
        continue;
      }

      try {
        const result = await this.processEvent(parsed.data);
        response[result].push(parsed.data.eventId);
      } catch (error: unknown) {
        if (this.isDuplicateEventError(error)) {
          response.duplicated.push(parsed.data.eventId);
          continue;
        }
        const rejection = this.toRejectedEvent(parsed.data.eventId, error);
        if (rejection === null) throw error;
        response.rejected.push(rejection);
      }
    }

    return response;
  }

  private processEvent(event: ValidatedReadingEvent): Promise<ProcessingResult> {
    return this.prisma.$transaction(async (transaction) => {
      const duplicate = await transaction.readingEvent.findUnique({
        where: { eventId: event.eventId },
        select: { id: true },
      });
      if (duplicate !== null) return 'duplicated';

      const article =
        event.eventType === ReadingEventType.PAGE_ENTER
          ? await this.articlesService.upsertFromEvent(transaction, event)
          : undefined;
      const session = await this.sessionsService.ensureForEvent(transaction, event, article?.id);

      await transaction.readingEvent.create({
        data: {
          eventId: event.eventId,
          sessionId: event.sessionId,
          eventType: event.eventType,
          sequenceNumber: event.sequenceNumber,
          occurredAt: new Date(event.occurredAt),
          receivedAt: new Date(),
          url: event.url,
          domain: event.domain.toLowerCase(),
          title: event.title,
          payload: event.context,
        },
      });
      await this.sessionsService.applyEvent(transaction, session, event);
      await this.sessionsService.recalculateInTransaction(transaction, event.sessionId, session.id);

      return 'accepted';
    });
  }

  private getCandidateEventId(input: unknown): string | null {
    if (typeof input !== 'object' || input === null || !('eventId' in input)) return null;
    return typeof input.eventId === 'string' ? input.eventId : null;
  }

  private toRejectedEvent(eventId: string, error: unknown): RejectedEvent | null {
    if (error instanceof SessionEventError) {
      return { eventId, reasons: [error.message] };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { eventId, reasons: ['Sequence number already exists for this session'] };
    }

    return null;
  }

  private isDuplicateEventError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return false;
    }
    const target = error.meta?.target;
    return Array.isArray(target) && target.some((field) => field === 'eventId');
  }
}
