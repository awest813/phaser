import { ORG_COLORS } from '../game/actions.ts';
import {
  payroll,
  playerPlace,
  playerStanding,
  playerTeam,
  raceLine,
  readTie,
  rankGroup,
  rankTeams,
  rosterIds,
  rosterReady,
  standingsFor,
  teamById
} from '../game/career.ts';
import { CHAMPION_MAP, CHAMPIONS, MYTH_LABEL, ROLE_BLURB, ROLE_LABEL, champName, patchTier } from '../game/champions.ts';
import { FACILITIES, facilityAt } from '../game/facilities.ts';
import {
  aiBan,
  buildDraft,
  coachNotes,
  counterStrategy,
  describeWeek,
  edgeLabel,
  findPlayerFixture,
  lineupProblems,
  opponentOf,
  teamPower
} from '../game/match.ts';
import { TRAIT_COPY, bestMasteryId, demand, masteryLabel, overall, roleChamps } from '../game/roster.ts';
import { confidantLine, draftSpeech, linkRank, morningLine, planSpeech, roomSpeech, tapeSpeech } from '../game/voice.ts';
import type { Speech } from '../game/voice.ts';
import type { AppState, Career, Champion, MatchKind, Player, RoomEvent, Strategy, Team, WeekPlan } from '../game/types.ts';

const STRATEGIES: { id: Strategy; name: string; text: string }[] = [
  { id: 'snowball', name: 'Snowball', text: 'End it early. Strong into scaling comps.' },
  { id: 'scale', name: 'Scale', text: 'Take the Worldheart and win late. Strong into protect.' },
  { id: 'protect', name: 'Protect', text: 'Pocket the slayer. Strong into pick comps.' },
  { id: 'pick', name: 'Pick', text: 'Catch the jungle paths. Strong into snowballs.' },
  { id: 'chaos', name: 'Chaos', text: 'High variance. Nobody’s plan survives.' }
];

const PREVIEW = [
  ['Mina Solberg', 'MINA', 'Warden', 'Main', '/portraits/port-01.jpg'],
  ['Kenji Arai', 'KITE', 'Slayer', 'Main', '/portraits/port-02.jpg'],
  ['Noor Hassan', 'VEIL', 'Weaver', 'Main', '/portraits/port-03.jpg'],
  ['Luca Ferreira', 'BOOM', 'Slayer', 'Main', '/portraits/port-04.jpg'],
  ['Sable Okonkwo', 'NYX', 'Weaver', 'Development', '/portraits/port-05.jpg'],
  ['Erik Nilsen', 'WOLF', 'Warden', 'Development', '/portraits/port-06.jpg']
];

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

function money(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString('en-US')}`;
}

function bar(value: number, max = 100, tone = ''): string {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  return `<span class="bar ${tone}"><span style="width:${width.toFixed(1)}%"></span></span>`;
}

function art(src: string, label: string, className = ''): string {
  return `<div class="art ${className}"><img src="${esc(src)}" alt="${esc(label)}" onerror="this.remove()" /><span>${esc(label)}</span></div>`;
}

function roleTag(role: Player['role']): string {
  return `<span class="tag role-${role}">${ROLE_LABEL[role]}</span>`;
}

function notice(app: AppState): string {
  if (!app.notice) return '';
  return `<div class="notice">${esc(app.notice)}</div>`;
}

export function render(app: AppState): string {
  if (app.screen === 'create') return createScreen(app);
  if (app.screen === 'title' || !app.career) return titleScreen(app);
  return shell(app, body(app));
}

function titleScreen(app: AppState): string {
  return `<main class="title">
    <img class="title-hero" src="/hero.jpg" alt="" />
    <div class="title-scrim"></div>
    <section class="title-copy">
      <p class="kicker">3v3 mythic MOBA</p>
      <h1>Pantheon Circuit</h1>
      <p class="lede">A general manager sim. Six players, twelve champions, and a garage that can become an arena. Preseason, a regular season, the Spire Cup, then playoffs.</p>
      <div class="row">
        <button class="btn primary" type="button" data-act="goto" data-screen="create">${app.career ? 'New career' : 'Open the garage'}</button>
        ${app.career ? `<button class="btn" type="button" data-act="goto" data-screen="${app.returnScreen}">Continue</button>` : ''}
      </div>
      ${notice(app)}
    </section>
  </main>`;
}

function createScreen(app: AppState): string {
  const draft = app.draft;
  return `<main class="create">
    <section class="create-copy">
      <p class="kicker">New organization</p>
      <h1>Start in the garage.</h1>
      <p>You inherit four players and two prospects. The main roster queues three. The development pair is there when someone breaks.</p>
      ${app.career ? '<p class="warn">Starting over replaces the saved career.</p>' : ''}
      <label>Organization<input id="org-name" name="name" data-field="name" maxlength="24" value="${esc(draft.name)}" /></label>
      <label>Tag<input id="org-tag" name="tag" data-field="tag" maxlength="3" value="${esc(draft.tag)}" /></label>
      <label>City<input id="org-city" name="city" data-field="city" maxlength="20" value="${esc(draft.city)}" /></label>
      <div class="swatches">${ORG_COLORS.map((color) => `<button type="button" class="swatch ${color.hex === draft.color ? 'on' : ''}" style="--swatch:${color.hex}" data-act="color" data-color="${color.hex}" aria-label="${esc(color.name)}"></button>`).join('')}</div>
      <div class="row">
        <button class="btn primary" type="button" data-act="begin">${app.career ? 'Replace and begin' : 'Begin season 1'}</button>
        <button class="btn ghost" type="button" data-act="goto" data-screen="title">Back</button>
      </div>
      ${notice(app)}
    </section>
    <section class="preview-grid">
      ${PREVIEW.map(([name, nick, role, group, src]) => `<article class="mini-player">
        ${art(src, nick)}
        <div><strong>${esc(nick)}</strong><span>${esc(name)}</span><em>${esc(role)} · ${esc(group)}</em></div>
      </article>`).join('')}
    </section>
  </main>`;
}

function shell(app: AppState, content: string): string {
  const career = app.career;
  if (!career) return content;
  const team = playerTeam(career);
  const items: [string, string][] = [
    ['office', 'Office'],
    ['roster', 'Roster'],
    ['champions', 'Champions'],
    ['match', 'Match day'],
    ['league', 'League'],
    ['facility', 'Facility'],
    ['finances', 'Finances']
  ];
  if (career.stage.kind === 'offseason') items.push(['offseason', 'Offseason']);
  return `<div class="shell" style="--org:${team.color}">
    <aside class="side">
      <div class="brand"><span>${esc(team.tag)}</span><strong>${esc(team.name)}</strong><em>Season ${career.year}</em></div>
      <nav>${items.map(([id, label]) => `<button type="button" class="${app.screen === id ? 'on' : ''}" data-act="goto" data-screen="${id}">${label}</button>`).join('')}</nav>
      <button class="btn ghost tiny" type="button" data-act="goto" data-screen="title">Main menu</button>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="phase">${seasonRail(career)}<span class="kicker">${esc(phaseLabel(career))}</span><strong>${esc(describeWeek(career)?.label ?? 'Offseason')}</strong>${weekBeats(app)}</div>
        <div class="meters">
          ${streakMeter(career.streak ?? 0)}
          <div class="meter"><span>Cash</span><strong>${money(team.cash)}</strong></div>
          <div class="meter"><span>Fans</span><strong>${team.fans.toLocaleString('en-US')}</strong></div>
          <div class="meter"><span>House</span><strong>${esc(facilityAt(team.facility).name)}</strong></div>
        </div>
      </header>
      ${notice(app)}
      ${content}
    </div>
  </div>`;
}

function seasonRail(career: Career): string {
  const kind = career.stage.kind;
  const cupOn = kind === 'cup' || kind === 'cup-semi' || kind === 'cup-final';
  const playOn = kind === 'play-in' || kind === 'playoff-semi' || kind === 'playoff-final';
  const cupDone = !cupOn && career.cupResult !== 'Not started';
  const steps: [string, boolean, boolean][] = [
    ['Preseason', kind === 'preseason', kind !== 'preseason'],
    ['Regular', kind === 'regular', kind !== 'preseason' && kind !== 'regular'],
    ['Spire Cup', cupOn, cupDone],
    ['Playoffs', playOn, kind === 'offseason'],
    ['Market', kind === 'offseason', false]
  ];
  return `<div class="season-rail">${steps.map(([label, now, done]) => `<span class="${now ? 'now' : done ? 'done' : ''}">${label}</span>`).join('')}</div>`;
}

function weekBeats(app: AppState): string {
  const career = app.career;
  if (!career || career.stage.kind === 'offseason') return '';
  const sitting = !findPlayerFixture(career);
  const planned = !!career.plan;
  const onMatch = app.screen === 'match';
  const onTape = app.screen === 'result';
  if (sitting || (onTape && career.lastReport?.kind === 'bye')) {
    return `<div class="beats"><span>1 Plan</span><span>2 Draft</span><span class="${onTape ? 'on' : 'now'}">3 Tape</span></div>`;
  }
  const planClass = planned || onMatch || onTape ? 'on' : 'now';
  const draftClass = onTape || onMatch ? 'on' : planned ? 'now' : '';
  const tapeClass = onTape ? 'on' : '';
  return `<div class="beats"><span class="${planClass}">1 Plan</span><span class="${draftClass}">2 Draft</span><span class="${tapeClass}">3 Tape</span></div>`;
}

function streakMeter(streak: number): string {
  if (streak === 0) return '';
  const hot = streak > 0;
  return `<div class="meter ${hot ? 'hot' : 'cold'}"><span>${hot ? 'Streak' : 'Skid'}</span><strong>${hot ? `W${streak}` : `L${Math.abs(streak)}`}</strong></div>`;
}

function streakCopy(streak: number): string {
  if (streak >= 5) return `Win streak W${streak}. The next series carries +8 power.`;
  if (streak >= 3) return `Win streak W${streak}. The next series carries +4 power.`;
  if (streak >= 1) return `Win streak W${streak}. One more and the building notices.`;
  if (streak <= -3) return `Skid L${Math.abs(streak)}. The next series is down 4 power until you stop it.`;
  if (streak <= -1) return `Skid L${Math.abs(streak)}. A win flips it.`;
  return '';
}

function bountyLine(career: Career): string {
  const bounty = career.bounty;
  if (!bounty) return '';
  return `<p class="bounty"><strong>Bounty</strong> ${esc(bounty.text)} <span>${money(bounty.reward)}</span></p>`;
}

function phaseLabel(career: Career): string {
  const stage = career.stage.kind;
  const name = stage === 'cup' || stage === 'cup-semi' || stage === 'cup-final' ? 'Spire Cup' : stage === 'play-in' || stage === 'playoff-semi' || stage === 'playoff-final' ? 'Playoffs' : stage === 'preseason' ? 'Preseason' : stage === 'offseason' ? 'Offseason' : 'Regular season';
  return `${name} · ${playerStanding(career).wins}-${playerStanding(career).losses}`;
}

function body(app: AppState): string {
  switch (app.screen) {
    case 'roster':
      return rosterScreen(app);
    case 'player':
      return playerScreen(app);
    case 'champions':
      return championScreen(app);
    case 'match':
      return matchScreen(app);
    case 'result':
      return resultScreen(app);
    case 'league':
      return leagueScreen(app);
    case 'facility':
      return facilityScreen(app);
    case 'finances':
      return financeScreen(app);
    case 'offseason':
      return offseasonScreen(app);
    default:
      return officeScreen(app);
  }
}

function pips(rank: number): string {
  return `<span class="pips">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= rank ? 'on' : ''}"></i>`).join('')}</span>`;
}

function datePlate(career: Career): string {
  const stage = career.stage;
  let phase = 'Offseason';
  let n = '—';
  if (stage.kind === 'preseason') {
    phase = 'Preseason';
    n = String(stage.round + 1).padStart(2, '0');
  } else if (stage.kind === 'regular') {
    phase = 'Regular';
    n = String(stage.round + 1).padStart(2, '0');
  } else if (stage.kind === 'cup') {
    phase = 'Spire Cup';
    n = String(stage.round + 1).padStart(2, '0');
  } else if (stage.kind === 'cup-semi') {
    phase = 'Spire Cup';
    n = 'SF';
  } else if (stage.kind === 'cup-final') {
    phase = 'Spire Cup';
    n = 'F';
  } else if (stage.kind === 'play-in') {
    phase = 'Playoffs';
    n = 'IN';
  } else if (stage.kind === 'playoff-semi') {
    phase = 'Playoffs';
    n = 'SF';
  } else if (stage.kind === 'playoff-final') {
    phase = 'Playoffs';
    n = 'F';
  }
  const numbered = /^\d/.test(n);
  return `<div class="dateplate"><span>${esc(phase)}</span><strong>${esc(n)}</strong>${numbered ? '<em>Week</em>' : ''}</div>`;
}

function scene(career: Career, speech: Speech, opts: { date?: boolean; replies?: RoomEvent | null; slim?: boolean } = {}): string {
  const player = career.players[speech.speakerId];
  if (!player) return '';
  const rank = linkRank(career, player.id);
  const replies = opts.replies;
  return `<article class="panel scene${opts.slim ? ' slim' : ''}">
    <div class="bust">${art(player.portrait, player.nick)}</div>
    <div class="scene-body">
      <div class="scene-top">
        <div>
          <div class="nameplate"><strong>${esc(player.nick)}</strong><small>${esc(TRAIT_COPY[player.trait].name)}</small></div>
          <div class="link-rank">Link ${rank} ${pips(rank)}</div>
        </div>
        ${opts.date ? datePlate(career) : ''}
      </div>
      <p class="line">${esc(speech.text)}</p>
      ${replies ? `<div class="replies">
        <button type="button" data-act="room" data-side="a"><b>1</b><span><strong>${esc(replies.a.label)}</strong><em>${esc(replies.a.detail)}</em></span></button>
        <button type="button" data-act="room" data-side="b"><b>2</b><span><strong>${esc(replies.b.label)}</strong><em>${esc(replies.b.detail)}</em></span></button>
      </div>` : ''}
    </div>
  </article>`;
}

function officeScene(career: Career): string {
  if (career.plan) return scene(career, morningLine(career), { date: true });
  const talk = roomSpeech(career);
  if (talk && career.room && !career.roomSpent) return scene(career, talk, { date: true, replies: career.room });
  if (talk && career.roomSpent) return scene(career, talk, { date: true });
  return scene(career, morningLine(career), { date: true });
}

function planBlock(career: Career): string {
  const fixture = findPlayerFixture(career);
  if (career.stage.kind === 'offseason' || !fixture) return '';
  const foe = teamById(career, opponentOf(fixture, career.playerTeamId));
  if (career.plan) {
    const name = career.plan === 'scrim' ? `Scrim ${foe.tag}` : career.plan === 'house' ? 'House' : career.plan === 'study' ? 'Study' : 'Rest';
    return `<article class="panel plan-locked">
      <div>
        <p class="kicker">Plan locked · ${esc(name)}</p>
        <p class="scrim-note">${esc(career.planNote || 'The week is set.')}</p>
      </div>
      <button class="btn primary" type="button" data-act="goto" data-screen="match">Open the draft</button>
    </article>`;
  }
  const cards: [WeekPlan, string, string][] = [
    ['scrim', `Scrim ${foe.tag}`, 'One game against this opponent. A purse, fatigue on both lineups, and their habit on the board.'],
    ['house', 'House', 'Starters against prospects. Chemistry rises. Everyone tires.'],
    ['study', 'Study', 'Each player works the champion they are studying. Mastery moves before the draft.'],
    ['rest', 'Rest', 'Fatigue comes off now, so the players you queue are the fresh ones.']
  ];
  return `<article class="panel week-choice">
    <h2>Spend the week</h2>
    <div class="plan-grid">${cards
      .map(([id, name, text]) => {
        const voice = planSpeech(career, id);
        const who = career.players[voice.speakerId];
        return `<button type="button" data-act="plan" data-plan="${id}"><span class="who">${who ? esc(who.nick) : ''}</span><strong>${esc(name)}</strong><em>${esc(voice.text)}</em><span>${esc(text)}</span></button>`;
      })
      .join('')}</div>
  </article>`;
}

function tradeBlock(career: Career): string {
  if (career.stage.kind === 'offseason') return '';
  const offer = career.offers[0];
  if (!offer) return '';
  const give = career.players[offer.theyGive];
  const want = career.players[offer.theyWant];
  return `<article class="call">
    <div>
      <p class="kicker">On the line</p>
      <p>${esc(offer.note)}</p>
      <p class="muted">${want ? `${esc(want.nick)} ${overall(want)}` : ''} · ${give ? `${esc(give.nick)} ${overall(give)}, pot ${give.potential}` : ''}. Gone once the match is queued.</p>
    </div>
    <div class="row">
      <button class="btn primary" type="button" data-act="trade-accept" data-id="${offer.id}">Accept</button>
      <button class="btn" type="button" data-act="trade-decline" data-id="${offer.id}">Decline</button>
    </div>
  </article>`;
}

function fixtureKicker(career: Career, foe: { id: string } | null, fixture: { homeId: string; series: number } | null): string {
  if (!foe || !fixture) return career.stage.kind === 'offseason' ? 'Offseason' : 'This round';
  const place = foe.id === career.rivalId ? `Rivalry · heat ${career.rivalHeat}` : fixture.homeId === career.playerTeamId ? 'Home' : 'Away';
  return fixture.series > 1 ? `${place} · best of ${fixture.series}` : place;
}

function byeTitle(career: Career): string {
  if (career.stage.kind === 'play-in' && career.playoffs?.seeds.slice(0, 2).includes(career.playerTeamId)) return 'First-round bye';
  return 'You watch this round';
}

function byeHook(career: Career): string {
  if (career.stage.kind === 'play-in' && career.playoffs?.seeds.slice(0, 2).includes(career.playerTeamId)) {
    return 'Seeds one and two wait. The play-in decides who you meet.';
  }
  return 'Your roster is not in it. The other series still count.';
}

function awardBlock(career: Career): string {
  if (!career.awards.length) return '';
  return `<article class="panel span-2"><h2>Season ${career.awards[0].year} awards</h2><ul class="news">${career.awards.map((award) => `<li>${esc(award.title)}: ${esc(award.playerName)} (${esc(teamById(career, award.teamId).tag)}) · ${esc(award.detail)}</li>`).join('')}</ul></article>`;
}

function officeScreen(app: AppState): string {
  const career = app.career;
  if (!career) return '';
  const team = playerTeam(career);
  const fixture = findPlayerFixture(career);
  const standing = playerStanding(career);
  const place = playerPlace(career);
  const foe = fixture ? teamById(career, opponentOf(fixture, team.id)) : null;
  const trade = tradeBlock(career);
  const plan = planBlock(career);
  return `<section class="desk week">
    ${officeScene(career)}
    <article class="fixture">
      <div>
        <p class="kicker">${fixtureKicker(career, foe, fixture)}</p>
        <h1>${foe ? esc(foe.name) : career.stage.kind === 'offseason' ? 'The market is open' : byeTitle(career)}</h1>
        <p class="hook">${foe || career.stage.kind === 'offseason' ? esc(raceLine(career)) : esc(byeHook(career))}</p>
        ${streakCopy(career.streak ?? 0) ? `<p class="${(career.streak ?? 0) > 0 ? 'streak-hot' : 'streak-cold'}">${esc(streakCopy(career.streak ?? 0))}</p>` : ''}
        ${career.stage.kind === 'offseason' ? '<div class="row"><button class="btn primary" type="button" data-act="goto" data-screen="offseason">Open the market</button></div>' : ''}
        ${!foe && career.stage.kind !== 'offseason' ? '<div class="row"><button class="btn primary" type="button" data-act="play">Let the week play</button></div>' : ''}
      </div>
      <dl class="stats">
        <div><dt>Record</dt><dd>${standing.wins}-${standing.losses}</dd></div>
        <div><dt>Place</dt><dd>${place || '—'}</dd></div>
        <div><dt>Chemistry</dt><dd>${Math.round(team.chemistry)}</dd></div>
        <div><dt>Payroll</dt><dd>${money(payroll(career))}</dd></div>
      </dl>
      ${bountyLine(career)}
    </article>
    ${plan}
    ${trade}
    ${career.patchUnread ? `<article class="banner"><div><p class="kicker">Patch ${esc(career.patchName)}</p><p>${career.patchNotes.map((line) => esc(line)).join(' ') || 'A quiet rift.'}</p></div><button class="btn" type="button" data-act="dismiss-patch">Noted</button></article>` : ''}
    ${awardBlock(career)}
    <div class="split shelf">
      <article class="panel">
        <h2>Season goals</h2>
        <ul class="goals">${career.goals.map((goal) => `<li class="${goal.done ? 'done' : ''}">${esc(goal.text)}</li>`).join('')}</ul>
      </article>
      <article class="panel">
        <h2>Wire</h2>
        <ul class="news">${career.news.slice(0, 5).map((item) => `<li>${esc(item.text)}</li>`).join('') || '<li>The garage is quiet.</li>'}</ul>
      </article>
    </div>
    ${career.history.length ? `<article class="panel span-2"><h2>Previous seasons</h2><ul class="news">${career.history.map((season) => `<li>Season ${season.year}: ${season.wins}-${season.losses}, Cup ${esc(season.cup)}, Playoffs ${esc(season.playoff)}, MVP ${esc(season.mvp)}</li>`).join('')}</ul></article>` : ''}
    ${app.confirmAbandon ? '<button class="btn danger span-2" type="button" data-act="abandon">Confirm abandon career</button>' : '<button class="btn ghost span-2" type="button" data-act="ask-abandon">Abandon career</button>'}
  </section>`;
}

function rosterScreen(app: AppState): string {
  const career = app.career;
  if (!career) return '';
  const team = playerTeam(career);
  return `<section class="stack">
    <header class="section-head"><h1>Roster</h1></header>
    <h2>Main roster</h2>
    <div class="roster-grid main">${team.main.map((id) => playerCard(career, id, team.dev)).join('')}</div>
    <h2>Development team</h2>
    <div class="roster-grid dev">${team.dev.map((id) => playerCard(career, id, team.main)).join('')}</div>
  </section>`;
}

function rosterNote(career: Career, player: Player): string {
  if (player.injured) return `Out ${player.injured}`;
  if (career.promiseId === player.id) return 'Promised the start';
  if (player.sat >= 2) return 'Wants minutes';
  const best = bestMasteryId(player);
  if (player.study && player.study !== best) return `Studying ${champName(player.study)}`;
  return '';
}

function playerCard(career: Career, id: string, swapWith: string[]): string {
  const player = career.players[id];
  const best = bestMasteryId(player);
  const note = rosterNote(career, player);
  return `<article class="player-card">
    <button class="portrait-btn" type="button" data-act="select-player" data-id="${id}">${art(player.portrait, player.nick)}</button>
    <div class="ovr-badge">${overall(player)}<small>OVR</small></div>
    <div class="player-body">
      <div class="row spread"><strong>${esc(player.nick)}</strong>${roleTag(player.role)}</div>
      <span class="muted">${esc(player.name)} · ${player.age}</span>
      <p>${esc(TRAIT_COPY[player.trait].name)} · ${esc(champName(best))} ${player.mastery[best] ?? 0}</p>
      ${note ? `<p class="scrim-note">${esc(note)}</p>` : ''}
      <div class="meters-mini"><span>Morale ${Math.round(player.morale)}</span>${bar(player.morale)}<span>Fatigue ${Math.round(player.fatigue)}</span>${bar(player.fatigue, 100, 'fatigue')}</div>
      <span class="muted">${player.contractStatus === 'expiring' ? 'Contract expired' : `${player.contractYears}y · ${money(player.salary)}/wk`}</span>
      <div class="row wrap">${swapWith.map((other) => `<button class="btn tiny" type="button" data-act="swap" data-a="${id}" data-b="${other}">Swap ${esc(career.players[other].nick)}</button>`).join('')}</div>
    </div>
  </article>`;
}

function playerScreen(app: AppState): string {
  const career = app.career;
  if (!career) return '';
  const player = career.players[app.selectedPlayerId ?? ''] ?? career.players[playerTeam(career).main[0]];
  const masteries = Object.entries(player.mastery).sort((a, b) => b[1] - a[1]);
  return `<section class="stack">
    <button class="btn ghost tiny" type="button" data-act="goto" data-screen="roster">Back to roster</button>
    ${scene(career, { speakerId: player.id, text: confidantLine(career, player.id) }, { slim: true })}
    <article class="panel">
        <p>${esc(player.name)}, ${player.age}. ${esc(TRAIT_COPY[player.trait].text)}</p>
        <dl class="stats">
          <div><dt>Overall</dt><dd>${overall(player)}</dd></div>
          <div><dt>Potential</dt><dd>${player.potential}</dd></div>
          <div><dt>Form</dt><dd>${player.form > 0 ? '+' : ''}${player.form.toFixed(1)}</dd></div>
          <div><dt>Salary</dt><dd>${money(player.salary)}</dd></div>
        </dl>
        ${statLine('Mechanics', player.mechanics)}
        ${statLine('Macro', player.macro)}
        ${statLine('Teamwork', player.teamwork)}
        ${statLine('Clutch', player.clutch)}
        <h2>Study</h2>
        <p class="muted">Auto draft queues this. Playing it, or locking it, hits a little harder.</p>
        <div class="row wrap">${roleChamps(player.role).map((id) => `<button type="button" class="btn tiny ${player.study === id ? 'on' : ''}" data-act="study" data-id="${player.id}" data-champ="${id}">${esc(champName(id))}</button>`).join('')}</div>
        ${rosterIds(playerTeam(career)).includes(player.id) && career.stage.kind !== 'offseason' ? `<div class="row"><button class="btn ${career.promiseId === player.id ? 'on' : ''}" type="button" data-act="promise" data-id="${player.id}">${career.promiseId === player.id ? 'Pull the promise' : 'Promise the start'}</button></div>` : ''}
        <h2>Links</h2>
        <ul class="news">${rosterIds(playerTeam(career))
          .filter((id) => id !== player.id)
          .map((id) => {
            const bond = readTie(career, player.id, id);
            const word = bond >= 2 ? 'close' : bond === 1 ? 'easy' : bond === 0 ? 'neutral' : bond === -1 ? 'cool' : 'friction';
            const rank = bond >= 2 ? 5 : bond === 1 ? 4 : bond === 0 ? 3 : bond === -1 ? 2 : 1;
            return `<li class="${bond > 0 ? 'streak-hot' : bond < 0 ? 'streak-cold' : ''}">${esc(career.players[id].nick)} · ${word} ${pips(rank)}</li>`;
          })
          .join('')}</ul>
        <h2>Champion pool</h2>
        ${masteries.map(([id, value]) => `<label>${esc(champName(id))} · ${masteryLabel(value)} ${bar(value)}</label>`).join('')}
        <p class="muted">Season ${player.seasonGames} games, ${player.seasonWins} series wins, ${player.seasonMvps} MVPs. Career MVPs ${player.careerMvps}.</p>
    </article>
  </section>`;
}

function statLine(label: string, value: number): string {
  return `<label>${label} ${value} ${bar(value)}</label>`;
}

function championScreen(app: AppState): string {
  const career = app.career;
  if (!career) return '';
  const selected = CHAMPION_MAP[app.selectedChampId] ?? CHAMPIONS[0];
  const myths = ['all', 'norse', 'egyptian', 'greek', 'japanese'] as const;
  const roles = ['all', 'warden', 'slayer', 'weaver'] as const;
  const list = CHAMPIONS.filter((champion) => (app.champMyth === 'all' || champion.mythology === app.champMyth) && (app.champRole === 'all' || champion.role === app.champRole));
  const holders = rosterIds(playerTeam(career))
    .map((id) => career.players[id])
    .map((player) => ({ player, value: player.mastery[selected.id] ?? 0 }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);
  const score = selected.base + (career.patch[selected.id] ?? 0);
  return `<section class="stack">
    <header class="section-head"><h1>Champion codex</h1></header>
    <div class="filters">
      ${myths.map((myth) => `<button type="button" class="${app.champMyth === myth ? 'on' : ''}" data-act="myth-filter" data-myth="${myth}">${myth === 'all' ? 'All myths' : MYTH_LABEL[myth]}</button>`).join('')}
      ${roles.map((role) => `<button type="button" class="${app.champRole === role ? 'on' : ''}" data-act="role-filter" data-role="${role}">${role === 'all' ? 'All roles' : ROLE_LABEL[role]}</button>`).join('')}
    </div>
    ${championFeature(career, selected, holders, score)}
    <div class="champ-grid">${list.map((champion) => champCard(career, champion, champion.id === selected.id)).join('')}</div>
  </section>`;
}

function championFeature(
  career: Career,
  champion: Champion,
  holders: { player: Player; value: number }[],
  score: number
): string {
  const mod = career.patch[champion.id] ?? 0;
  return `<article class="detail myth-${champion.mythology}">
    ${art(champion.art, champion.name, 'tall')}
    <div>
      <p class="kicker">${MYTH_LABEL[champion.mythology]} · ${ROLE_LABEL[champion.role]} · ${champion.scaling} game</p>
      <h1>${esc(champion.name)}</h1>
      <p class="muted">${esc(champion.title)} · Tier ${patchTier(score)} · patch ${mod > 0 ? '+' : ''}${mod}</p>
      <p>${esc(champion.fantasy)}</p>
      <p class="muted">${ROLE_BLURB[champion.role]}</p>
      <ul class="abilities">${champion.abilities.map((ability) => `<li><strong>${esc(ability.name)}.</strong> ${esc(ability.text)}</li>`).join('')}</ul>
      <p>Synergy: ${champion.synergy.map((id) => esc(champName(id))).join(', ')}</p>
      <p>${holders.length ? holders.map((entry) => `${esc(entry.player.nick)} ${entry.value}`).join(' · ') : 'Nobody on the roster has put real time into this champion.'}</p>
    </div>
  </article>`;
}

function champCard(career: Career, champion: Champion, on: boolean): string {
  const mod = career.patch[champion.id] ?? 0;
  return `<button type="button" class="champ-card myth-${champion.mythology} ${on ? 'on' : ''}" data-act="select-champ" data-id="${champion.id}">
    ${art(champion.art, champion.name)}
    <span class="champ-meta"><strong>${esc(champion.name)}</strong><em>${ROLE_LABEL[champion.role]} · ${patchTier(champion.base + mod)} ${mod > 0 ? '+' : ''}${mod}</em></span>
  </button>`;
}

function matchScreen(app: AppState): string {
  const career = app.career;
  if (!career) return '';
  if (career.stage.kind === 'offseason') {
    return `<section class="stack"><h1>No match</h1><p>The season is over.</p><button class="btn primary" type="button" data-act="goto" data-screen="offseason">Offseason</button></section>`;
  }
  const team = playerTeam(career);
  const fixture = findPlayerFixture(career);
  if (!fixture) return `<section class="stack"><h1>The week is empty.</h1></section>`;
  const foe = teamById(career, opponentOf(fixture, team.id));
  const theirBan = aiBan(career, foe.id, career.lineup.ban);
  const problems = lineupProblems(career);
  const scout = facilityAt(team.facility).scout;
  const activeId = career.lineup.playerIds[app.selectedSlot];
  const active = activeId ? career.players[activeId] : undefined;
  let edge = 'Set three champions to read the matchup.';
  if (problems.length === 0) {
    const yours = { playerIds: career.lineup.playerIds, champs: career.lineup.champs, strategy: career.lineup.strategy };
    const theirs = buildDraft(career, foe.id, new Set([career.lineup.ban, theirBan]), null);
    const home = fixture.homeId === team.id;
    const yoursPower = teamPower(career, team.id, yours, foe.strategy, fixture.kind, home);
    const oppPower = teamPower(career, foe.id, theirs, career.lineup.strategy, fixture.kind, !home);
    edge = edgeLabel(yoursPower.total - oppPower.total);
  }
  const foeRecord = standingsFor(career, 'regular').find((row) => row.teamId === foe.id);
  return `<section class="stack draft">
    <header class="fixture draft-head">
      <div>
        <p class="kicker">${foe.id === career.rivalId ? `Rivalry · heat ${career.rivalHeat}` : fixture.homeId === team.id ? 'Home' : 'Away'} · ${fixture.series === 1 ? 'one game' : `best of ${fixture.series}`}</p>
        <h1>${esc(foe.name)}</h1>
        <p class="hook">${esc(edge)}. ${foeRecord ? `${foeRecord.wins}-${foeRecord.losses}` : '0-0'}.</p>
        ${career.planNote ? `<p class="scrim-note">${esc(career.planNote)}</p>` : ''}
        ${bountyLine(career)}
      </div>
    </header>
    ${scene(career, draftSpeech(career), { slim: true })}
    <div class="slot-row">
      ${[0, 1, 2].map((index) => slotCard(career, index, app.selectedSlot === index)).join('')}
    </div>
    <article class="panel">
      <h2>Your ban</h2>
      <p class="muted">Gold is yours. Violet is ${esc(foe.tag)}. Theirs is ${esc(champName(theirBan))}.</p>
      <div class="ban-row">${CHAMPIONS.map((champion) => `<button type="button" class="ban ${career.lineup.ban === champion.id ? 'mine' : ''} ${theirBan === champion.id ? 'theirs' : ''}" data-act="ban" data-id="${champion.id}">${art(champion.art, champion.name)}<span>${esc(champion.name)}</span></button>`).join('')}</div>
    </article>
    <article class="panel">
      <h2>Lock a champion${active ? ` for ${esc(active.nick)}` : ''}</h2>
      <div class="champ-grid compact">${CHAMPIONS.map((champion) => {
        const mastery = active?.mastery[champion.id] ?? 0;
        const taken = Object.entries(career.lineup.champs).some(([id, champ]) => champ === champion.id && id !== activeId);
        const banned = champion.id === career.lineup.ban || champion.id === theirBan;
        return `<button type="button" class="champ-card small myth-${champion.mythology} ${career.lineup.champs[activeId ?? ''] === champion.id ? 'on' : ''}" data-act="assign-champ" data-id="${champion.id}">
          ${art(champion.art, champion.name)}
          <span class="champ-meta"><strong>${esc(champion.name)}</strong><em>${mastery ? `${mastery} ${masteryLabel(mastery)}` : 'New'}${banned ? ' · banned' : ''}${taken ? ' · taken' : ''}</em></span>
        </button>`;
      }).join('')}</div>
    </article>
    <article class="panel">
      <h2>Strategy</h2>
      <div class="choice">${STRATEGIES.map((strategy) => `<button type="button" class="${career.lineup.strategy === strategy.id ? 'on' : ''}" data-act="strategy" data-strategy="${strategy.id}"><strong>${strategy.name}</strong><span>${strategy.text}</span></button>`).join('')}</div>
    </article>
    <article class="panel bench">
      <h2>The other three</h2>
      <div class="row wrap">${rosterIds(team).map((id) => {
        const player = career.players[id];
        const queued = career.lineup.playerIds.includes(id);
        return `<button type="button" class="btn ${queued ? 'on' : ''}" data-act="assign-player" data-id="${id}">${esc(player.nick)} · ${ROLE_LABEL[player.role]} · fat ${Math.round(player.fatigue)}${player.injured ? ' · hurt' : ''}${team.dev.includes(id) ? ' · dev' : ''}</button>`;
      }).join('')}</div>
    </article>
    <div class="queue">
      <button class="btn" type="button" data-act="autofill">Auto draft</button>
      <button class="btn primary" type="button" data-act="play">Queue the match</button>
    </div>
    <div class="split appendix">
      <article class="panel">
        <h2>Scouting · ${esc(facilityAt(foe.facility).name)}</h2>
        <p>${esc(foe.blurb)}</p>
        <p>${foe.city} · ${foeRecord ? `${foeRecord.wins}-${foeRecord.losses}` : '0-0'} · coach's read: <strong>${esc(edge)}</strong></p>
        ${scout >= 1 || career.intel[foe.id] ? `<p>They like to ${esc(foe.strategy)}. A ${esc(counterStrategy(foe.strategy))} plan is the textbook answer.</p>${career.intel[foe.id] && scout < 1 ? '<p class="muted">You scrimmed them. The habit is no longer a guess.</p>' : ''}` : '<p class="muted">Upgrade out of the garage, or scrim them, to read their habits. Until then, trust the edge label and experiment.</p>'}
        ${scout >= 2 ? `<ul class="news">${chooseNames(career, foe).map((line) => `<li>${line}</li>`).join('')}</ul>` : ''}
        <p>Their ban: <strong>${esc(champName(theirBan))}</strong></p>
      </article>
      <article class="panel">
        <h2>Coach</h2>
        <ul class="news">${coachNotes(career, foe.strategy).map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
        ${problems.map((problem) => `<p class="warn">${esc(problem)}</p>`).join('')}
      </article>
    </div>
  </section>`;
}

function chooseNames(career: Career, team: Team): string[] {
  return team.main.slice(0, 3).map((id) => {
    const player = career.players[id];
    return `${esc(player.nick)} · ${ROLE_LABEL[player.role]} · ${overall(player)} OVR · ${esc(champName(bestMasteryId(player)))}`;
  });
}

function slotCard(career: Career, index: number, on: boolean): string {
  const id = career.lineup.playerIds[index];
  const player = id ? career.players[id] : undefined;
  const champId = player ? career.lineup.champs[player.id] : undefined;
  const champion = champId ? CHAMPION_MAP[champId] : undefined;
  return `<button type="button" class="slot ${on ? 'on' : ''}" data-act="slot" data-index="${index}">
    ${player ? art(player.portrait, player.nick) : '<div class="art"><span>Empty</span></div>'}
    <span><strong>${player ? esc(player.nick) : `Slot ${index + 1}`}</strong><em>${champion ? esc(champion.name) : 'No champion'}${player ? ` · fat ${Math.round(player.fatigue)}` : ''}</em></span>
  </button>`;
}

function resultScreen(app: AppState): string {
  const career = app.career;
  const report = career?.lastReport;
  if (!career || !report) return `<section class="stack"><h1>No result</h1></section>`;
  const kind = kindLabel(report.kind);
  const tone = report.won === undefined ? '' : report.won ? 'win' : 'loss';
  const streak = report.streakAfter ?? career.streak ?? 0;
  const streakMark = streak >= 2 ? ` · W${streak}` : streak <= -2 ? ` · L${Math.abs(streak)}` : '';
  const growth = report.growth ?? [];
  const offseason = career.stage.kind === 'offseason';
  return `<section class="stack scoreboard ${tone}">
    <p class="kicker">${esc(report.label)} · ${esc(kind)}</p>
    <h1>${report.won === undefined ? (report.kind === 'bye' ? 'Bye' : 'Week complete') : report.won ? 'Victory' : 'Defeat'}${streakMark}${report.scoreline ? ` ${esc(report.scoreline)}` : ''}</h1>
    <p>${report.opponentName ? `${report.home ? 'Home' : 'Away'} against ${esc(report.opponentName)}.` : ''} ${report.mvpName ? `${esc(report.mvpName)} takes MVP.` : ''}</p>
    <div class="pills"><span>${money(report.cashDelta)} cash</span><span>${report.fansDelta >= 0 ? '+' : ''}${report.fansDelta} fans</span>${report.bountyNote?.startsWith('Bounty cleared') ? '<span>Bounty paid</span>' : ''}</div>
    ${scene(career, tapeSpeech(career, report), { slim: true })}
    <button class="btn primary next-week" type="button" data-act="dismiss-result">${offseason ? 'Open the market' : 'Next week'}</button>
    <article class="panel pulse">
      <p class="kicker">${offseason ? 'The market' : 'Next week'}</p>
      <p class="hook-next">${esc(report.nextHook ?? 'The week is open.')}</p>
      ${report.planNote ? `<p>${esc(report.planNote)}</p>` : ''}
      ${report.raceLine ? `<p class="hook">${esc(report.raceLine)}</p>` : ''}
      ${streakCopy(streak) ? `<p class="${streak > 0 ? 'streak-hot' : 'streak-cold'}">${esc(streakCopy(streak))}</p>` : ''}
      ${report.bountyNote ? `<p class="${report.bountyNote.startsWith('Bounty cleared') ? 'scrim-note' : 'warn'}">${esc(report.bountyNote)}</p>` : ''}
      ${report.roomNote ? `<p>${esc(report.roomNote)}</p>` : ''}
      ${growth.length ? `<ul class="growth">${growth.map((line) => `<li><strong>${esc(line.nick)}</strong><span>${esc(line.text)}</span></li>`).join('')}</ul>` : ''}
    </article>
    ${report.notes.map((line) => `<p>${esc(line)}</p>`).join('')}
    ${report.patchNotes.length ? `<article class="banner"><div><p class="kicker">Patch ${esc(career.patchName)}</p><p>${report.patchNotes.map((line) => esc(line)).join(' ')}</p></div></article>` : ''}
    ${report.games.map((game, index) => `<article class="panel tape-log">
      <h2>Game ${index + 1} · ${esc(game.time)} · ${game.winnerId === career.playerTeamId ? 'Win' : 'Loss'}</h2>
      <p>${game.homeKills}–${game.awayKills} kills · Worldheart ${game.homeHeart}–${game.awayHeart} · gold ${Math.round(game.homeGold / 1000)}k–${Math.round(game.awayGold / 1000)}k</p>
      <ol class="timeline">${game.timeline.map((beat) => `<li><time>${esc(beat.t)}</time><span>${esc(beat.text)}</span></li>`).join('')}</ol>
    </article>`).join('')}
  </section>`;
}

function kindLabel(kind: MatchKind | 'bye'): string {
  if (kind === 'preseason') return 'Exhibition, standings unchanged';
  if (kind === 'regular') return 'Regular season';
  if (kind === 'cup') return 'Spire Cup group game';
  if (kind === 'cup-semi' || kind === 'cup-final') return 'Spire Cup knockout';
  if (kind === 'play-in') return 'Play-in';
  if (kind === 'playoff-semi' || kind === 'playoff-final') return 'Playoffs';
  return 'Week';
}

function leagueScreen(app: AppState): string {
  const career = app.career;
  if (!career) return '';
  const tabs = [
    ['standings', 'Standings'],
    ['schedule', 'Schedule'],
    ['cup', 'Spire Cup'],
    ['playoffs', 'Playoffs'],
    ['teams', 'Teams']
  ] as const;
  return `<section class="stack">
    <div class="filters">${tabs.map(([id, label]) => `<button type="button" class="${app.leagueTab === id ? 'on' : ''}" data-act="league-tab" data-tab="${id}">${label}</button>`).join('')}</div>
    ${app.leagueTab === 'schedule' ? scheduleTab(career) : app.leagueTab === 'cup' ? cupTab(career) : app.leagueTab === 'playoffs' ? playoffTab(career) : app.leagueTab === 'teams' ? teamsTab(app) : standingsTab(career)}
  </section>`;
}

function standingsTab(career: Career): string {
  const rows = standingsFor(career, 'regular');
  const rank = rankTeams(career);
  const fixture = findPlayerFixture(career);
  const foeId = fixture ? opponentOf(fixture, career.playerTeamId) : '';
  return `<article class="panel"><p class="kicker">Playoff line under 6 · bye for 1 and 2</p><h1>Regular season</h1>
    <table><thead><tr><th></th><th>Team</th><th class="num">W</th><th class="num">L</th><th class="num">Diff</th><th>Facility</th></tr></thead><tbody>
    ${rank.map((id, index) => {
      const team = teamById(career, id);
      const row = rows.find((entry) => entry.teamId === id);
      return `<tr class="${index === 6 ? 'cut' : ''} ${team.player ? 'you' : ''} ${id === foeId ? 'foe' : ''}"><td>${index + 1}</td><td><button type="button" data-act="view-team" data-id="${id}">${esc(team.name)}</button></td><td class="num">${row?.wins ?? 0}</td><td class="num">${row?.losses ?? 0}</td><td class="num">${row?.diff ?? 0}</td><td>${esc(facilityAt(team.facility).name)}</td></tr>`;
    }).join('')}
    </tbody></table></article>`;
}

function scheduleTab(career: Career): string {
  const team = playerTeam(career);
  const current = career.stage.kind === 'regular' ? career.stage.round : -1;
  const rounds = career.regularRounds.map((round, index) => {
    const pair = round.find(([home, away]) => home === team.id || away === team.id);
    if (!pair) return '';
    const home = pair[0] === team.id;
    const foe = teamById(career, home ? pair[1] : pair[0]);
    const log = career.results.find((result) => result.season === career.year && result.kind === 'regular' && result.homeId === pair[0] && result.awayId === pair[1]);
    const score = log ? `${log.winnerId === team.id ? 'W' : 'L'} ${home ? log.homeKills : log.awayKills}–${home ? log.awayKills : log.homeKills}` : 'Upcoming';
    return `<li class="${index === current ? 'now' : ''}"><span>Week ${index + 1} · ${home ? 'Home' : 'Away'}</span><strong>${esc(foe.name)}</strong><em>${score}</em></li>`;
  });
  return `<article class="panel"><h1>Circuit schedule</h1><ol class="schedule">${rounds.join('')}</ol></article>`;
}

function seriesCard(
  career: Career,
  label: string,
  series: { homeId: string; awayId: string; homeWins: number; awayWins: number; done: boolean } | null
): string {
  if (!series) return '';
  const home = teamById(career, series.homeId);
  const away = teamById(career, series.awayId);
  const yours = series.homeId === career.playerTeamId || series.awayId === career.playerTeamId;
  const homeWin = series.done && series.homeWins > series.awayWins;
  const awayWin = series.done && series.awayWins > series.homeWins;
  return `<article class="series-card${yours ? ' yours' : ''}">
    <p class="kicker">${esc(label)}${series.done ? '' : ' · scheduled'}</p>
    <div class="series-row${homeWin ? ' win' : ''}"><strong>${esc(home.name)}</strong><span>${series.homeWins}</span></div>
    <div class="series-row${awayWin ? ' win' : ''}"><strong>${esc(away.name)}</strong><span>${series.awayWins}</span></div>
  </article>`;
}

function cupTab(career: Career): string {
  if (!career.cup) return `<article class="panel"><h1>Spire Cup</h1><p>Groups lock after six regular-season games. Group games do not change the regular standings.</p></article>`;
  const table = (ids: string[], title: string) => {
    const rank = rankGroup(career, ids);
    const rows = standingsFor(career, 'cup');
    return `<div><h2>${title}</h2><table><tbody>${rank.map((id, index) => {
      const row = rows.find((entry) => entry.teamId === id);
      const team = teamById(career, id);
      return `<tr class="${id === career.playerTeamId ? 'you' : ''} ${index < 2 ? 'in' : ''}"><td>${esc(team.tag)}</td><td>${row?.wins ?? 0}-${row?.losses ?? 0}</td><td>${row?.diff ?? 0}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  };
  return `<article class="panel"><p class="kicker">${esc(career.cupResult)}${career.cup.championId ? ` · ${esc(teamById(career, career.cup.championId).name)}` : ''}</p><h1>Spire Cup</h1>
    <div class="split">${table(career.cup.groups.a, 'Group A')}${table(career.cup.groups.b, 'Group B')}</div>
    <div class="bracket">${career.cup.semis.map((series, index) => seriesCard(career, `Semi ${index + 1}`, series)).join('')}${seriesCard(career, 'Final', career.cup.final)}</div>
  </article>`;
}

function playoffTab(career: Career): string {
  if (!career.playoffs) return `<article class="panel"><h1>Playoffs</h1><p>Top six after the regular season. Seeds 1 and 2 wait. 3 plays 6, 4 plays 5, then the semifinals and a best-of-five final.</p></article>`;
  return `<article class="panel"><p class="kicker">${esc(career.playoffResult)}${career.playoffs.championId ? ` · ${esc(teamById(career, career.playoffs.championId).name)}` : ''}</p><h1>Playoffs</h1>
    <ol class="seeds">${career.playoffs.seeds.map((id, index) => `<li class="${id === career.playerTeamId ? 'you' : ''}">${index + 1}. ${esc(teamById(career, id).name)}</li>`).join('')}</ol>
    <div class="bracket">
      ${career.playoffs.playIn.map((series, index) => seriesCard(career, `Play-in ${index + 1}`, series)).join('')}
      ${career.playoffs.semis.map((series, index) => seriesCard(career, `Semifinal ${index + 1}`, series)).join('')}
      ${seriesCard(career, 'Final', career.playoffs.final)}
    </div>
  </article>`;
}

function teamsTab(app: AppState): string {
  const career = app.career;
  if (!career) return '';
  const selected = teamById(career, app.viewedTeamId ?? career.playerTeamId);
  const scout = facilityAt(playerTeam(career).facility).scout;
  const showRoster = selected.player || scout >= 2;
  return `<div class="split">
    <article class="panel"><h2>Organizations</h2><ul class="news">${career.orgs.map((team) => `<li><button type="button" data-act="view-team" data-id="${team.id}">${esc(team.name)}</button> · ${esc(facilityAt(team.facility).name)}</li>`).join('')}</ul></article>
    <article class="panel">
      <p class="kicker" style="color:${selected.color}">${esc(selected.tag)} · ${esc(selected.city)}</p>
      <h1>${esc(selected.name)}</h1>
      <p>${esc(selected.blurb)}</p>
      <p>${esc(facilityAt(selected.facility).name)} · ${selected.fans.toLocaleString('en-US')} fans · ${esc(selected.strategy)} tendency</p>
      ${showRoster ? `<div class="roster-grid">${rosterIds(selected).map((id) => {
        const player = career.players[id];
        return `<article class="player-card mini"><div class="player-body"><strong>${esc(player.nick)}</strong><span>${ROLE_LABEL[player.role]} · ${overall(player)}</span><span class="muted">${selected.dev.includes(id) ? 'Development' : 'Main'} · ${esc(champName(bestMasteryId(player)))}</span></div></article>`;
      }).join('')}</div>` : '<p class="muted">Your scouting staff cannot see this roster yet. The Bootcamp Loft opens starter sheets.</p>'}
    </article>
  </div>`;
}

function facilityScreen(app: AppState): string {
  const career = app.career;
  if (!career) return '';
  const team = playerTeam(career);
  const current = facilityAt(team.facility);
  const next = FACILITIES[team.facility + 1];
  return `<section class="stack">
    <article class="fixture">
      <div>
        <p class="kicker">House</p>
        <h1>${esc(current.name)}</h1>
        <p class="hook">${esc(current.scene)}</p>
        <p class="muted">${esc(current.unlock)}</p>
        ${next ? `<button class="btn primary" type="button" data-act="upgrade" ${team.cash < next.cost ? 'disabled' : ''}>Upgrade to ${esc(next.name)} · ${money(next.cost)}</button>` : '<p>The facility is complete.</p>'}
        ${next && team.cash < next.cost ? `<p class="muted">Need ${money(next.cost - team.cash)} more.</p>` : ''}
      </div>
      <dl class="stats">
        <div><dt>Training</dt><dd>${current.training.toFixed(2)}×</dd></div>
        <div><dt>Recovery</dt><dd>${current.recovery.toFixed(2)}×</dd></div>
        <div><dt>Revenue</dt><dd>${current.revenue.toFixed(2)}×</dd></div>
        <div><dt>Upkeep</dt><dd>${money(current.upkeep)}</dd></div>
      </dl>
    </article>
    <ol class="facility-path">${FACILITIES.map((facility, index) => `<li class="${index === team.facility ? 'now' : ''} ${index < team.facility ? 'done' : ''}"><strong>${esc(facility.name)}</strong><span>${index === team.facility ? 'You are here' : esc(facility.scene)}</span>${index > 0 ? `<em>${money(facility.cost)}</em>` : ''}</li>`).join('')}</ol>
  </section>`;
}

function financeScreen(app: AppState): string {
  const career = app.career;
  if (!career) return '';
  const team = playerTeam(career);
  const facility = facilityAt(team.facility);
  const sponsor = Math.round((1500 + team.reputation * 55) * facility.revenue);
  return `<section class="stack">
    <article class="fixture">
      <div>
        <p class="kicker">${esc(facility.name)} · revenue ${facility.revenue.toFixed(2)}×</p>
        <h1>${money(team.cash)}</h1>
      </div>
      <dl class="stats">
        <div><dt>Payroll</dt><dd>${money(payroll(career))}</dd></div>
        <div><dt>Upkeep</dt><dd>${money(facility.upkeep)}</dd></div>
        <div><dt>Sponsor</dt><dd>${money(sponsor)}</dd></div>
        <div><dt>Fans</dt><dd>${team.fans.toLocaleString('en-US')}</dd></div>
      </dl>
    </article>
    <article class="panel">
      <h2>Roster salaries</h2>
      <table><tbody>${rosterIds(team).map((id) => {
        const player = career.players[id];
        return `<tr><td>${esc(player.nick)}</td><td>${team.dev.includes(id) ? 'Dev' : 'Main'}</td><td>${money(player.salary)}/wk</td><td>${player.contractYears}y</td></tr>`;
      }).join('')}</tbody></table>
    </article>
    <article class="panel"><h2>Ledger</h2><ul class="news">${career.ledger.map((entry) => `<li>${esc(entry.label)} · ${esc(entry.note)} · ${money(entry.amount)} · balance ${money(entry.balance)}</li>`).join('') || '<li>No transactions yet.</li>'}</ul></article>
  </section>`;
}

function offseasonScreen(app: AppState): string {
  const career = app.career;
  if (!career) return '';
  if (career.stage.kind !== 'offseason') {
    return `<section class="stack"><h1>Still in season</h1><p>The market opens when the playoffs end.</p></section>`;
  }
  const team = playerTeam(career);
  const ready = rosterReady(career);
  const standing = playerStanding(career);
  return `<section class="stack">
    <article class="fixture">
      <div>
        <p class="kicker">Season ${career.year}</p>
        <h1>${standing.wins}–${standing.losses}</h1>
        <p class="hook">Cup ${esc(career.cupResult)}. Playoffs ${esc(career.playoffResult)}.</p>
        <p class="muted">Re-sign anyone whose deal expired, then open the next season.</p>
      </div>
      <dl class="stats">
        <div><dt>Place</dt><dd>${playerPlace(career) || '—'}</dd></div>
        <div><dt>Cash</dt><dd>${money(team.cash)}</dd></div>
        <div><dt>Payroll</dt><dd>${money(payroll(career))}</dd></div>
        <div><dt>Fans</dt><dd>${team.fans.toLocaleString('en-US')}</dd></div>
      </dl>
    </article>
    ${awardBlock(career)}
    <h2>Your roster</h2>
    <div class="roster-grid">${rosterIds(team).map((id) => contractCard(career, id)).join('')}</div>
    <h2>The market</h2>
    <div class="roster-grid">${career.freeAgents.map((id) => freeAgentCard(career, id)).join('') || '<p>The market is empty.</p>'}</div>
    ${ready ? `<p class="warn">${esc(ready)}</p>` : '<p class="muted">Roster is set. The next patch drops when the new season opens.</p>'}
    <button class="btn primary next-week" type="button" data-act="next-season">Begin season ${career.year + 1}</button>
  </section>`;
}

function contractCard(career: Career, id: string): string {
  const player = career.players[id];
  const team = playerTeam(career);
  const ask = demand(player);
  const severance = player.contractStatus === 'expiring' || player.contractYears <= 0 ? 0 : player.salary * 4 * player.contractYears;
  return `<article class="player-card market-card">${art(player.portrait, player.nick)}<div class="player-body">
    <strong>${esc(player.nick)}</strong>
    <span>${overall(player)} OVR · pot ${player.potential} · ${ROLE_LABEL[player.role]}</span>
    <span class="muted">${player.contractStatus === 'expiring' ? `Expired · wants ${money(ask)}/wk` : `${player.contractYears}y left · ${money(player.salary)}/wk`}</span>
    ${player.contractStatus === 'expiring' ? `<div class="row wrap">${[1, 2, 3].map((years) => `<button class="btn tiny" type="button" data-act="resign" data-id="${id}" data-years="${years}">${years}y</button>`).join('')}</div>` : ''}
    <button class="btn tiny" type="button" data-act="release" data-id="${id}">Release${severance ? ` · ${money(severance)}` : ''}</button>
    <span class="muted">${team.dev.includes(id) ? 'Development' : 'Main roster'}</span>
  </div></article>`;
}

function freeAgentCard(career: Career, id: string): string {
  const player = career.players[id];
  const team = playerTeam(career);
  const blocked = overall(player) >= 80 && team.facility < 5;
  return `<article class="player-card market-card">${art(player.portrait, player.nick)}<div class="player-body">
    <strong>${esc(player.nick)}</strong>
    <span>${esc(player.name)} · ${player.age} · ${ROLE_LABEL[player.role]}</span>
    <span>${overall(player)} OVR · pot ${player.potential} · ${money(player.salary)}/wk</span>
    <span class="muted">${esc(champName(bestMasteryId(player)))} · ${esc(TRAIT_COPY[player.trait].name)}</span>
    ${blocked ? '<p class="warn">Needs a performance center.</p>' : `<div class="row wrap free-actions">${['main', 'dev'].flatMap((side) => [1, 2, 3].map((years) => `<button class="btn tiny" type="button" data-act="sign" data-id="${id}" data-side="${side}" data-years="${years}">${side === 'main' ? 'Main' : 'Dev'} ${years}y</button>`)).join('')}</div>`}
  </div></article>`;
}
