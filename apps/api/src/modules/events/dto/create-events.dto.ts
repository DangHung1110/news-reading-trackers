import { ArrayMaxSize, ArrayMinSize, IsArray } from 'class-validator';

export class CreateEventsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  events!: unknown[];
}
