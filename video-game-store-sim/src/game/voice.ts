import { readTie } from './career.ts';
import { champName } from './champions.ts';
import { findPlayerFixture, opponentOf, playerTeam, rosterIds, teamById } from './match.ts';
import type { Career, Player, RoomEvent, Trait, WeekPlan, WeekReport } from './types.ts';

export interface Speech {
  speakerId: string;
  text: string;
}

function roster(career: Career): Player[] {
  return rosterIds(playerTeam(career))
    .map((id) => career.players[id])
    .filter((player): player is Player => !!player);
}

function pick(lines: readonly string[], salt: string): string {
  let hash = 0;
  for (let i = 0; i < salt.length; i++) hash = (Math.imul(hash, 33) + salt.charCodeAt(i)) >>> 0;
  return lines[hash % lines.length] ?? lines[0];
}

function byTrait(players: Player[], trait: Trait): Player | undefined {
  return players.find((player) => player.trait === trait);
}

function byRole(players: Player[], role: Player['role']): Player | undefined {
  return players.find((player) => player.role === role);
}

export function squadVoice(career: Career): Player {
  const players = roster(career);
  return byTrait(players, 'leader') ?? players[0];
}

export function linkRank(career: Career, id: string): number {
  const others = roster(career).filter((player) => player.id !== id);
  if (!others.length) return 3;
  const avg = others.reduce((sum, player) => sum + readTie(career, id, player.id), 0) / others.length;
  if (avg >= 1.5) return 5;
  if (avg >= 0.5) return 4;
  if (avg <= -1.5) return 1;
  if (avg <= -0.4) return 2;
  return 3;
}

const OPEN: Record<string, readonly string[]> = {
  mina: ['The week is ours if we spend it on purpose. Tell me the plan.', 'I want one clean plan, then the rift. Talk to me first.'],
  kite: ['Point me at a champion or a throat. I do not do both badly.', 'I already know who I want. The week decides if I get them.'],
  veil: ['Read the patch, then the room. In that order.', 'The meta moved. I would rather meet it in study than on the rift.'],
  boom: ['I am restless. Give the week a shape before I invent one.', 'Quiet weeks make me worse. Pick something with a pulse.'],
  nyx: ['I can feel the week. Put me on something that teaches.', 'If I am not in the plan, say so. I would rather hear it here.'],
  wolf: ['Wrists first, then pride. Tell me which one this week is.', 'I will grind whatever you lock. Just lock it.']
};

const TRAIT_OPEN: Record<Trait, string> = {
  leader: 'The week is ours if we spend it on purpose.',
  onetrick: 'Point me at my champion, or get out of the way of the draft.',
  meta: 'Read the patch before we spend the week.',
  volatile: 'Give the week a shape before I invent one.',
  prodigy: 'Put me on something that teaches.',
  grinder: 'I will grind whatever you lock. Just lock it.',
  clutch: 'Save the sharp work for the series. Tell me what the week is.'
};

const PLAN: Record<string, Record<WeekPlan, string>> = {
  mina: {
    scrim: 'Scrim them. I want their comms in my ear before the series.',
    house: 'We run it in the house. I need to hear us.',
    study: 'Study. I want the champion boring by the time we ban.',
    rest: 'Rest the wrists. A tired call loses the first fight.'
  },
  kite: {
    scrim: 'One scrim. I want their slayer on the tape.',
    house: 'House is fine if I still get the last set.',
    study: 'Give me the champion. I will have the hands by the draft.',
    rest: 'I can rest. Do not rest me out of the queue.'
  },
  veil: {
    scrim: 'Scrim for the draft, not for a highlight.',
    house: 'House, and we talk about the patch while we run it.',
    study: 'This is the week the patch wants. Let me study it.',
    rest: 'Rest is a read too, if fatigue is the story.'
  },
  boom: {
    scrim: 'Scrim. I want a fight before the real one.',
    house: 'Put us in a room and let it get loud.',
    study: 'I will study if I still get to swing it.',
    rest: 'Rest makes me worse. I will do it if you say the word.'
  },
  nyx: {
    scrim: 'Scrim them. I learn faster against a real team.',
    house: 'House. I want the starters talking to me.',
    study: 'Let me study. I will show you in the draft.',
    rest: 'I can take the rest. I would rather take the reps.'
  },
  wolf: {
    scrim: 'Scrim. Extra work is the point.',
    house: 'House block. I will take the long set.',
    study: 'Study is work. I am good at work.',
    rest: 'The wrists need it. I hate that it is true.'
  }
};

const TRAIT_PLAN: Record<Trait, Record<WeekPlan, string>> = {
  leader: {
    scrim: 'Scrim them. I want their shape before we ban.',
    house: 'House. I need to hear the comms.',
    study: 'Study, then the draft. No surprise we could have drilled.',
    rest: 'Rest the ones who call the fights.'
  },
  onetrick: {
    scrim: 'One scrim. I want their slayer on the tape.',
    house: 'House is fine if the last set is mine.',
    study: 'Give me the champion. I will have the hands.',
    rest: 'I can rest. Do not rest me out of the queue.'
  },
  meta: {
    scrim: 'Scrim for the draft, not for the highlight.',
    house: 'House, and we talk about the patch while we run it.',
    study: 'This is the week the patch wants. Study it.',
    rest: 'Rest is a read too, if the fatigue is the story.'
  },
  volatile: {
    scrim: 'Scrim. I want a fight before the real one.',
    house: 'Put us in a room and let it get loud.',
    study: 'I will study if you promise I still get to swing.',
    rest: 'Rest makes me worse. I will do it if you say it.'
  },
  prodigy: {
    scrim: 'Scrim them. I learn faster against a real team.',
    house: 'House. I want the starters talking to me.',
    study: 'Let me study. I will show you in the draft.',
    rest: 'I can take the rest. I would rather take the reps.'
  },
  grinder: {
    scrim: 'Scrim. Extra work is the point.',
    house: 'House block. I will take the long set.',
    study: 'Study is work. I am good at work.',
    rest: 'The wrists need it. I hate that it is true.'
  },
  clutch: {
    scrim: 'Scrim the close rounds. That is the part I play.',
    house: 'House, and leave the heroics for the series.',
    study: 'Study the champion you want in a deciding game.',
    rest: 'Rest now. I spend it when the series is long.'
  }
};

const LOCKED: Record<WeekPlan, string> = {
  scrim: 'I have their habit. Ban from the tape.',
  house: 'The sets are in us. So is the fatigue.',
  study: 'The champion is in my hands. Do not ban it for me.',
  rest: 'We are fresh. Spend that on the queue.'
};

const WIN: Record<string, string> = {
  mina: 'That is a week we can build on. Do not get precious about it.',
  kite: 'I had the hands. Leave the champion where it is.',
  veil: 'The read was right. I want the next one cleaner.',
  boom: 'Again. I am not done being loud.',
  nyx: 'I can feel that one. Let the next week teach me more.',
  wolf: 'Good. Ice the wrists before we talk about the next one.'
};

const LOSS: Record<string, string> = {
  mina: 'We lost the series, not the building. Say what the next week is.',
  kite: 'I missed. Put me back on the champion and do not narrate it.',
  veil: 'The draft lied to us. I want another look before we queue.',
  boom: 'I hate that. I want the next one meaner.',
  nyx: 'I will get better at that. Do not bench the lesson.',
  wolf: 'Losses happen. Soft hands do not. We work.'
};

const TRAIT_WIN: Record<Trait, string> = {
  leader: 'That is a week we can build on. Do not get precious about it.',
  onetrick: 'I had the hands. Leave the champion where it is.',
  meta: 'The read was right. I want the next one cleaner.',
  volatile: 'Again. I am not done being loud.',
  prodigy: 'I can feel that one. Let the next week teach me more.',
  grinder: 'Good. Ice the wrists before we talk about the next one.',
  clutch: 'That is the series I play for. Leave the next one just as tight.'
};

const TRAIT_LOSS: Record<Trait, string> = {
  leader: 'We lost the series, not the building. Say what the next week is.',
  onetrick: 'I missed. Put me back on the champion and do not narrate it.',
  meta: 'The draft lied to us. I want another look before we queue.',
  volatile: 'I hate that. I want the next one meaner.',
  prodigy: 'I will get better at that. Do not bench the lesson.',
  grinder: 'Losses happen. Soft hands do not. We work.',
  clutch: 'I did not get the last game. Give me another series that needs one.'
};

const SELF: Record<string, string> = {
  mina: 'I keep this room pointed at the series. Talk to me before you talk to the board.',
  kite: 'The champion I study is the one. Everything else is how I get back to it.',
  veil: 'Tell me the patch and I will tell you the draft.',
  boom: 'I play hot. If you need calm, you already have someone else for that.',
  nyx: 'I am not a starter until you say I am. I will not stay quiet about it forever.',
  wolf: 'Development is a room, not a sentence. I am here to take a series off someone.'
};

const TRAIT_SELF: Record<Trait, string> = {
  leader: 'I keep the room pointed at the series. That is the job.',
  onetrick: 'One champion, played like I invented it. Everything else is a compromise.',
  meta: 'I read the patch so the draft is not a guess.',
  volatile: 'I am brilliant, or I am a problem. The week decides which.',
  prodigy: 'I am still becoming the player you queued.',
  grinder: 'I will be here after the loud ones get tired.',
  clutch: 'Call me when the series is one game from ending.'
};

function openLine(player: Player, salt: string): string {
  const cast = OPEN[player.id];
  if (cast) return pick(cast, salt);
  return TRAIT_OPEN[player.trait];
}

function weekSalt(career: Career): string {
  const stage = career.stage;
  const round = 'round' in stage ? stage.round : 0;
  return `${career.year}:${stage.kind}:${round}`;
}

export function planSpeaker(career: Career, plan: WeekPlan): Player {
  const healthy = roster(career).filter((player) => player.injured <= 0);
  const pool = healthy.length ? healthy : roster(career);
  if (plan === 'scrim') return byRole(pool, 'slayer') ?? pool[0];
  if (plan === 'house') return byTrait(pool, 'leader') ?? byRole(pool, 'warden') ?? pool[0];
  if (plan === 'study') return byRole(pool, 'weaver') ?? pool[0];
  return [...pool].sort((a, b) => b.fatigue - a.fatigue)[0] ?? pool[0];
}

export function planSpeech(career: Career, plan: WeekPlan): Speech {
  const speaker = planSpeaker(career, plan);
  return { speakerId: speaker.id, text: PLAN[speaker.id]?.[plan] ?? TRAIT_PLAN[speaker.trait][plan] };
}

export function morningLine(career: Career): Speech {
  const speaker = squadVoice(career);
  if (career.stage.kind === 'offseason') {
    return { speakerId: speaker.id, text: 'The season is dark. The market is the only door that still opens.' };
  }
  if (career.plan) {
    const who = planSpeaker(career, career.plan);
    return { speakerId: who.id, text: LOCKED[career.plan] };
  }
  const fixture = findPlayerFixture(career);
  const foe = fixture ? teamById(career, opponentOf(fixture, career.playerTeamId)) : null;
  const streak = career.streak ?? 0;
  if (foe && foe.id === career.rivalId) {
    return { speakerId: speaker.id, text: `${foe.name} again. Heat ${career.rivalHeat}. I want this one before we queue.` };
  }
  if (streak >= 3) return { speakerId: speaker.id, text: `${streak} straight. Do not get cute with the plan.` };
  if (streak <= -2) return { speakerId: speaker.id, text: 'The skid is in the room. One honest plan, then the rift.' };
  return { speakerId: speaker.id, text: openLine(speaker, weekSalt(career)) };
}

export function roomSpeech(career: Career): Speech | null {
  const room = career.room;
  if (!room || career.stage.kind === 'offseason') return null;
  const speaker = career.players[room.ids[0]];
  if (!speaker) return null;
  if (career.roomSpent) {
    return { speakerId: speaker.id, text: career.roomEcho || 'That talk is done for the week.' };
  }
  return { speakerId: speaker.id, text: roomAsk(career, room) };
}

function roomAsk(career: Career, room: RoomEvent): string {
  const first = career.players[room.ids[0]];
  const second = room.ids[1] ? career.players[room.ids[1]] : undefined;
  if (room.kind === 'share' && second) return `We both want the block. If you hand it to ${second.nick}, I will hear that.`;
  if (room.kind === 'promise') {
    return first.sat >= 2 ? 'Two weeks on the bench. I am not asking this time.' : 'I want this series. Put me on the rift.';
  }
  if (room.kind === 'rest') return `I am at ${Math.round(first.fatigue)} fatigue. Give me the block, or tell me to play through it.`;
  if (room.kind === 'study' && room.champId) return `I want the week on ${champName(room.champId)}. Put it on me and I will queue it.`;
  return 'Let me stream the garage. The router can take it. The neighbors already know the schedule.';
}

export function draftSpeech(career: Career): Speech {
  if (career.promiseId && career.players[career.promiseId]) {
    return { speakerId: career.promiseId, text: 'You promised me the rift. I am in the queue, or the room hears it.' };
  }
  if (career.plan) {
    const who = planSpeaker(career, career.plan);
    return { speakerId: who.id, text: LOCKED[career.plan] };
  }
  const speaker = squadVoice(career);
  return { speakerId: speaker.id, text: openLine(speaker, `${weekSalt(career)}:draft`) };
}

export function tapeSpeech(career: Career, report: WeekReport): Speech {
  const players = roster(career);
  const mvp = players.find((player) => player.nick === report.mvpName);
  const speaker = mvp ?? squadVoice(career);
  const streak = report.streakAfter ?? career.streak ?? 0;
  if (report.won && streak >= 3) {
    return { speakerId: speaker.id, text: `${streak} straight. The building is loud. Keep the next plan simple.` };
  }
  if (report.won === false && streak <= -3) {
    return { speakerId: speaker.id, text: 'That is a skid. One clean week stops it. I can feel it in the comms.' };
  }
  if (report.won) return { speakerId: speaker.id, text: WIN[speaker.id] ?? TRAIT_WIN[speaker.trait] };
  if (report.won === false) return { speakerId: speaker.id, text: LOSS[speaker.id] ?? TRAIT_LOSS[speaker.trait] };
  return { speakerId: speaker.id, text: 'The week is closed. The market is what is left.' };
}

export function confidantLine(career: Career, id: string): string {
  const player = career.players[id];
  if (!player) return '';
  if (career.promiseId === id) return 'You promised me the start. I am holding you to the queue.';
  if (player.sat >= 2) return 'I have sat long enough. The next queue should have my name.';
  const others = roster(career).filter((other) => other.id !== id);
  let closest: Player | undefined;
  let best = -99;
  for (const other of others) {
    const bond = readTie(career, id, other.id);
    if (bond > best) {
      best = bond;
      closest = other;
    }
  }
  if (closest && best >= 2) return `${closest.nick} and I do not have to say much. The rift is easier.`;
  if (closest && best <= -2) return `${closest.nick} and I are on the same rift and not the same team.`;
  if (player.id === 'kite') return `${champName(player.study)} is the one. The rest of the pool is how I get back.`;
  return SELF[player.id] ?? TRAIT_SELF[player.trait];
}
