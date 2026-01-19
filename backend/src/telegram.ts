import { Telegram } from 'puregram';

const botCache = new Map<string, Telegram>();
const pollingBots = new Set<string>();

function getBot(botToken: string): Telegram {
  let bot = botCache.get(botToken);
  if (!bot) {
    bot = Telegram.fromToken(botToken);
    botCache.set(botToken, bot);
  }
  return bot;
}

export async function startBotPolling(botToken: string): Promise<void> {
  if (!botToken || pollingBots.has(botToken)) return;
  
  try {
    const bot = getBot(botToken);
    pollingBots.add(botToken);
    
    bot.updates.on('message', (context) => {
      if (context.text === '/start') {
        context.send(`👋 Привет!\n\nВаш Telegram ID: <code>${context.senderId}</code>\n\nСкопируйте его и вставьте в настройки профиля.`, { parse_mode: 'HTML' });
      }
    });
    
    await bot.updates.startPolling();
    console.log(`✅ Telegram bot polling started for token: ${botToken.slice(0, 10)}...`);
  } catch (error) {
    console.error('Failed to start bot polling:', error);
    pollingBots.delete(botToken);
  }
}

export async function sendNotification(botToken: string, telegramId: string, message: string): Promise<boolean> {
  if (!botToken || !telegramId) return false;
  
  try {
    const bot = getBot(botToken);
    await bot.api.sendMessage({ chat_id: telegramId, text: message, parse_mode: 'HTML' });
    return true;
  } catch (error) {
    console.error('Telegram notification error:', error);
    return false;
  }
}

export async function notifyTaskAssigned(
  botToken: string,
  telegramId: string,
  taskTitle: string,
  projectName: string,
  assignerName: string
): Promise<boolean> {
  const message = `🔔 <b>Вам назначена задача</b>\n\n📋 <b>${taskTitle}</b>\n📁 Проект: ${projectName}\n👤 Назначил: ${assignerName}`;
  return sendNotification(botToken, telegramId, message);
}

export async function notifyTaskStatusChanged(
  botToken: string,
  telegramId: string,
  taskTitle: string,
  projectName: string,
  oldStatus: string,
  newStatus: string
): Promise<boolean> {
  const message = `📝 <b>Статус задачи изменён</b>\n\n📋 <b>${taskTitle}</b>\n📁 Проект: ${projectName}\n${oldStatus} → ${newStatus}`;
  return sendNotification(botToken, telegramId, message);
}
