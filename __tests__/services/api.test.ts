import { startRaffle, stopRaffle, pickWinner } from '../../services/api';

const mockToken = 'test-token';

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('startRaffle', () => {
  it('sends POST to RAFFLE_START with token and body', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(new Response(null, { status: 200 }));

    const params = {
      keyword: '!test',
      game: 'roulette',
      streamer: 'testuser',
      subMult: 2,
      giftMult: 3,
    };

    await startRaffle(mockToken, params);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/api/raffle/start');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(opts.body)).toEqual(params);
  });
});

describe('stopRaffle', () => {
  it('sends POST to RAFFLE_STOP with token', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(new Response(null, { status: 200 }));

    await stopRaffle(mockToken);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/api/raffle/stop');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer test-token');
  });
});

describe('pickWinner', () => {
  it('sends POST to PICK_WINNER with token', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(new Response(null, { status: 200 }));

    await pickWinner(mockToken);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/api/raffle/pick-winner');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer test-token');
  });
});
