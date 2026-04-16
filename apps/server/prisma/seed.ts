import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../src/security/password.js';

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await hashPassword('ChangeMe123!@#');

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    create: {
      username: 'admin',
      email: 'admin@poker.local',
      displayName: 'Admin',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN
    },
    update: {
      passwordHash: adminPasswordHash,
      email: 'admin@poker.local'
    }
  });

  await prisma.wallet.upsert({
    where: { userId_currency_layer: { userId: admin.id, currency: 'USDT', layer: 'PLAYER' } },
    create: {
      userId: admin.id,
      type: 'PLAYER',
      layer: 'PLAYER',
      currency: 'USDT',
      flags: {}
    },
    update: {}
  });

  const tableSeeds = [
    { id: '00000000-0000-0000-0000-000000000101', name: 'Micro Rush', stakes: '0.02/0.05', maxSeats: 6 },
    { id: '00000000-0000-0000-0000-000000000102', name: 'Low Stakes Grind', stakes: '0.10/0.20', maxSeats: 6 },
    { id: '00000000-0000-0000-0000-000000000103', name: 'Mid Stakes Prime', stakes: '0.50/1.00', maxSeats: 6 },
    { id: '00000000-0000-0000-0000-000000000104', name: 'High Roller Ring', stakes: '2.00/5.00', maxSeats: 6 },
    { id: '00000000-0000-0000-0000-000000000105', name: 'Heads-Up Arena', stakes: '1.00/2.00', maxSeats: 2 }
  ] as const;

  for (const table of tableSeeds) {
    await prisma.table.upsert({
      where: { id: table.id },
      create: table,
      update: { name: table.name, stakes: table.stakes, maxSeats: table.maxSeats, status: 'OPEN' }
    });
  }

  await prisma.wallet.upsert({
    where: { type_layer_currency: { type: 'INTERNAL', layer: 'COLD_TREASURY', currency: 'USDT' } },
    create: {
      type: 'INTERNAL',
      layer: 'COLD_TREASURY',
      currency: 'USDT',
      availableBalance: '1000000',
      flags: {}
    },
    update: {}
  });

  await prisma.wallet.upsert({
    where: { type_layer_currency: { type: 'INTERNAL', layer: 'STANDBY_REFILL', currency: 'USDT' } },
    create: {
      type: 'INTERNAL',
      layer: 'STANDBY_REFILL',
      currency: 'USDT',
      availableBalance: '100000',
      flags: {}
    },
    update: {}
  });

  await prisma.wallet.upsert({
    where: { type_layer_currency: { type: 'INTERNAL', layer: 'HOT_PAYOUT', currency: 'USDT' } },
    create: {
      type: 'INTERNAL',
      layer: 'HOT_PAYOUT',
      currency: 'USDT',
      availableBalance: '10000',
      flags: {}
    },
    update: {}
  });

  await prisma.internalWalletPolicy.upsert({
    where: { currency: 'USDT' },
    create: {
      currency: 'USDT',
      hotMaxBalance: '50000',
      hotMinBalance: '5000',
      standbyMinBalance: '25000'
    },
    update: {}
  });

  await prisma.rakeRuleConfig.upsert({
    where: { version: 1 },
    create: {
      version: 1,
      gameType: 'NLHE',
      stakeMin: '0.01',
      stakeMax: '5',
      blindMin: '1',
      blindMax: '500',
      headsUpOnly: false,
      minTableSize: 2,
      maxTableSize: 9,
      noFlopNoDrop: true,
      rakeBps: 500,
      maxCap: '3',
      currency: 'USDT',
      vipDiscountBps: 0,
      effectiveFrom: new Date(Date.now() - 60_000),
      active: true,
      metadata: {}
    },
    update: {}
  });

  await prisma.vipRule.upsert({
    where: { level: 1 },
    create: { level: 1, label: 'Bronze', rakebackBps: 500, pointsPerUsdRake: '10', active: true },
    update: {}
  });

  await prisma.vipRule.upsert({
    where: { level: 2 },
    create: { level: 2, label: 'Silver', rakebackBps: 1000, pointsPerUsdRake: '12', active: true },
    update: {}
  });

  await prisma.missionTemplate.createMany({
    data: [
      { title: 'Daily Login', description: 'Log in once today', missionType: 'DAILY_LOGIN', goal: 1, rewardAmount: '1', currency: 'USDT', active: true },
      { title: 'Play 20 Hands', description: 'Play twenty hands today', missionType: 'PLAY_HANDS', goal: 20, rewardAmount: '2', currency: 'USDT', active: true }
    ],
    skipDuplicates: true
  });

  await prisma.promoCampaign.createMany({
    data: [
      { title: 'Welcome Week', body: 'Complete missions for rewards', bonusCode: 'WELCOME', active: true }
    ],
    skipDuplicates: true
  });

  const tournament = await prisma.tournament.upsert({
    where: { id: '00000000-0000-0000-0000-000000000901' },
    create: {
      id: '00000000-0000-0000-0000-000000000901',
      name: 'Nightly Kickoff',
      type: 'MTT',
      status: 'SCHEDULED',
      buyIn: '10',
      fee: '1',
      currency: 'USDT',
      startsAt: new Date(Date.now() + 3_600_000),
      lateRegEndsAt: new Date(Date.now() + 5_400_000),
      startsInSeconds: 3600,
      blindLevelSeconds: 300,
      maxPlayers: 200
    },
    update: {}
  });

  await prisma.tournamentBlindLevel.createMany({
    data: [
      { tournamentId: tournament.id, level: 1, smallBlind: '10', bigBlind: '20', ante: '0', startsAtOffsetSec: 0 },
      { tournamentId: tournament.id, level: 2, smallBlind: '15', bigBlind: '30', ante: '0', startsAtOffsetSec: 300 }
    ],
    skipDuplicates: true
  });

  await prisma.tournamentPayoutLadder.createMany({
    data: [
      { tournamentId: tournament.id, placeFrom: 1, placeTo: 1, payoutPercent: '35' },
      { tournamentId: tournament.id, placeFrom: 2, placeTo: 3, payoutPercent: '20' }
    ],
    skipDuplicates: true
  });

}

main().finally(async () => prisma.$disconnect());
