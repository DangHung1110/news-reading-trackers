describe('loadSiteConfigs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('persists active remote configs and respects disabled defaults', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', {
      storage: {
        local: { get: vi.fn().mockResolvedValue({}), set },
        sync: { get: vi.fn().mockResolvedValue({ apiUrl: 'http://localhost:3000/api' }) },
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                domain: 'vnexpress.net',
                enabled: false,
                articleUrlPatterns: ['vnexpress'],
                titleSelectors: ['h1'],
                contentSelectors: ['article'],
                removeSelectors: [],
              },
              {
                domain: 'example.com',
                enabled: true,
                articleUrlPatterns: ['example'],
                titleSelectors: ['h1'],
                contentSelectors: ['article'],
                removeSelectors: [],
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const { loadSiteConfigs } = await import('./site-configs');
    const configs = await loadSiteConfigs();

    expect(configs.map(({ domain }) => domain)).toContain('example.com');
    expect(configs.map(({ domain }) => domain)).not.toContain('vnexpress.net');
    expect(set).toHaveBeenCalledOnce();
  });
});
