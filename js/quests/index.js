import missingTrophy from './missing-trophy.js';
import riverWatch from './river-watch.js';
import phantomLogin from './phantom-login.js';
import gameShop from './game-shop.js';
import planetHunters from './planet-hunters.js';
import chartToppers from './chart-toppers.js';
import wildlifeWatch from './wildlife-watch.js';
import sportsDay from './sports-day.js';

export const QUESTS = [missingTrophy, riverWatch, phantomLogin, gameShop, planetHunters, chartToppers, wildlifeWatch, sportsDay];

export function findQuest(id) { return QUESTS.find(q => q.id === id); }
