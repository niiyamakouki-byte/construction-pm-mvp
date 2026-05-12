import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { MeetingRepository } from './MeetingRepository.js';
import * as supabaseClient from '../repository/supabase-client.js';

function makeBuilder(terminal: { data: unknown; error: { message: string } | null }) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  const term = () => Promise.resolve(terminal);
  b.select = vi.fn(chain);
  b.eq = vi.fn(chain);
  b.insert = vi.fn(chain);
  b.update = vi.fn(chain);
  b.delete = vi.fn(chain);
  b.single = vi.fn(term);
  b.maybeSingle = vi.fn(term);
  (b as { then?: unknown }).then = (
    res: (v: unknown) => unknown,
    rej?: (e: unknown) => unknown,
  ) => Promise.resolve(terminal).then(res, rej);
  return b;
}

const mockFrom = (
  supabaseClient as unknown as { supabase: { from: ReturnType<typeof vi.fn> } }
).supabase.from;

describe('MeetingRepository — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true の getMeetingAsync が meeting_minutes を参照しフィールド変換する', async () => {
    const row = {
      id: 'm-1',
      project_id: 'p-1',
      meeting_date: '2026-05-13',
      meeting_type: '定例',
      facilitator: '我妻',
      location: '南青山',
      attendees: [{ name: '光輝' }],
      discussion_points: ['工程'],
      created_at: '2026-05-13T00:00:00.000Z',
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new MeetingRepository(true);
    const result = await repo.getMeetingAsync('m-1');
    expect(mockFrom).toHaveBeenCalledWith('meeting_minutes');
    expect(result?.facilitator).toBe('我妻');
    expect(result?.attendees[0]?.name).toBe('光輝');
    expect(result?.discussionPoints).toEqual(['工程']);
  });

  it('useSupabase=true の listActionItemsByMeetingAsync が meeting_action_items を参照しフィルタ', async () => {
    const rows = [
      {
        id: 'ai-1',
        meeting_id: 'm-1',
        description: 'タイル発注',
        owner: '鈴木',
        due_date: null,
        status: 'open',
      },
      {
        id: 'ai-2',
        meeting_id: 'm-2',
        description: '別件',
        owner: '光輝',
        due_date: null,
        status: 'open',
      },
    ];
    mockFrom.mockReturnValue(makeBuilder({ data: rows, error: null }));

    const repo = new MeetingRepository(true);
    const result = await repo.listActionItemsByMeetingAsync('m-1');
    expect(mockFrom).toHaveBeenCalledWith('meeting_action_items');
    expect(result).toHaveLength(1);
  });

  it('useSupabase=false で Supabase を呼ばない', async () => {
    const repo = new MeetingRepository(false);
    await repo.saveMeetingAsync({
      id: 'm-1',
      projectId: 'p-1',
      meetingDate: '2026-05-13',
      meetingType: '定例',
      facilitator: '我妻',
      attendees: [],
      discussionPoints: [],
      createdAt: '2026-05-13T00:00:00.000Z',
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
