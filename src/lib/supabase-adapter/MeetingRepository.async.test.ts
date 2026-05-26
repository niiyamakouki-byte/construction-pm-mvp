import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { MeetingRepository } from './MeetingRepository.js';
import type {
  MeetingMinutesRecord,
  MeetingActionItemRecord,
} from './MeetingRepository.js';

function makeMeeting(o: Partial<MeetingMinutesRecord> = {}): MeetingMinutesRecord {
  return {
    id: 'm-1',
    projectId: 'proj-1',
    meetingDate: '2026-05-13',
    meetingType: '定例',
    facilitator: '我妻',
    attendees: [{ name: '光輝' }, { name: '鈴木', company: 'ラポルタ' }],
    discussionPoints: ['工程確認', '材料発注'],
    createdAt: '2026-05-13T00:00:00.000Z',
    ...o,
  };
}

function makeActionItem(o: Partial<MeetingActionItemRecord> = {}): MeetingActionItemRecord {
  return {
    id: 'ai-1',
    meetingId: 'm-1',
    description: 'タイル発注',
    owner: '鈴木',
    status: 'open',
    ...o,
  };
}

describe('MeetingRepository async (InMemory mode)', () => {
  let repo: MeetingRepository;

  beforeEach(() => {
    repo = new MeetingRepository(false);
  });

  it('saveMeetingAsync→getMeetingAsync', async () => {
    await repo.saveMeetingAsync(makeMeeting({ location: '南青山事務所' }));
    const found = await repo.getMeetingAsync('m-1');
    expect(found?.facilitator).toBe('我妻');
    expect(found?.location).toBe('南青山事務所');
  });

  it('attendees と discussionPoints が保持される', async () => {
    await repo.saveMeetingAsync(makeMeeting());
    const found = await repo.getMeetingAsync('m-1');
    expect(found?.attendees).toHaveLength(2);
    expect(found?.attendees[1]?.company).toBe('ラポルタ');
    expect(found?.discussionPoints).toEqual(['工程確認', '材料発注']);
  });

  it('listMeetingsByProjectAsync がフィルタする', async () => {
    await repo.saveMeetingAsync(makeMeeting({ id: 'm-1', projectId: 'A' }));
    await repo.saveMeetingAsync(makeMeeting({ id: 'm-2', projectId: 'B' }));
    expect((await repo.listMeetingsByProjectAsync('A')).length).toBe(1);
  });

  it('deleteMeetingAsync は true/false を返す', async () => {
    await repo.saveMeetingAsync(makeMeeting());
    expect(await repo.deleteMeetingAsync('m-1')).toBe(true);
    expect(await repo.deleteMeetingAsync('m-1')).toBe(false);
  });

  it('saveActionItemAsync→listActionItemsByMeetingAsync が meeting でフィルタ', async () => {
    await repo.saveActionItemAsync(makeActionItem({ id: 'ai-1', meetingId: 'm-1' }));
    await repo.saveActionItemAsync(makeActionItem({ id: 'ai-2', meetingId: 'm-2' }));
    const list = await repo.listActionItemsByMeetingAsync('m-1');
    expect(list).toHaveLength(1);
  });

  it('action item status と dueDate が保持される', async () => {
    await repo.saveActionItemAsync(
      makeActionItem({ status: 'done', dueDate: '2026-05-20' }),
    );
    const list = await repo.listActionItemsByMeetingAsync('m-1');
    expect(list[0]?.status).toBe('done');
    expect(list[0]?.dueDate).toBe('2026-05-20');
  });

  it('deleteActionItemAsync は true/false を返す', async () => {
    await repo.saveActionItemAsync(makeActionItem());
    expect(await repo.deleteActionItemAsync('ai-1')).toBe(true);
    expect(await repo.deleteActionItemAsync('ai-1')).toBe(false);
  });
});
