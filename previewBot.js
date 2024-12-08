import TelegramBot from 'node-telegram-bot-api';
import pg from 'pg';

const token = '8036723818:AAGesSKxyrY_1a6uetSaRarUx1KRnqNu_Tg';
const bot = new TelegramBot(token, { polling: true });

const pool = new pg.Pool({
    host: '45-61-56-109.cloud-xip.com',
    user: 'postgres',
    password: 'lovemeless',
    database: 'casino_db',
    port: 5432
});

// Function to get the user's balance, XP, rank, and bonus claim dates
async function getUserData(userId) {
    try {
        const result = await pool.query(`
            SELECT balance, xp, rank, daily_bonus_last_claim, weekly_bonus_last_claim 
            FROM users 
            WHERE telegram_id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            throw new Error('User not found');
        }

        const { balance, xp, rank, daily_bonus_last_claim, weekly_bonus_last_claim } = result.rows[0];
        return { balance, xp, rank, daily_bonus_last_claim, weekly_bonus_last_claim };
    } catch (error) {
        throw new Error(`Failed to get user data: ${error.message}`);
    }
}

// Function to handle profile command/button with session isolation
async function handleProfileCommand(chatId, userId, msg, isPrivate = false) {
  try {
    // Fetch user data (balance, XP, rank, and username)
    const { balance, xp, rank } = await getUserData(userId);

    // Ensure balance is a valid number before proceeding
    const numericBalance = parseFloat(balance);
    if (isNaN(numericBalance)) {
      throw new Error(`Invalid balance value: ${balance}`);
    }

    const balanceInUSD = (numericBalance * 69.42).toFixed(2);
    const balanceInLTC = numericBalance.toFixed(8);

    // Calculate the user's rank and progress to the next rank
    const { rank: userRank, nextRank, progress, nextXP } = calculateRankAndProgress(xp);
    const progressBar = createProgressBar(progress);

    // Get current season info
    const seasonEmoji = "🍂";
    const modifiersDisplay = "[2X XP]";

    // Display username
    const displayUsername = msg.from.username
      ? `@${msg.from.username}`
      : msg.from.first_name || 'User';

    // Construct the profile message
    const profileMessage = `
╭──╯ ⋯ ⋯ ⋯ ⋯ ⋯ ⋯  ╰──╮
<b>───── ⋆⋅HVYSTAKES⋅⋆ ────</b>
<b>Season Zero 🎄 MODIFIERS: [TBD]</b> 
⊹₊⟡⋆⊹₊⟡⋆⊹₊⟡⋆⊹₊⟡⋆⊹₊⟡⋆⊹₊⟡⋆
👋 Hello ${displayUsername}

💸 <b>Balance:</b> $${balanceInUSD} <i>(${balanceInLTC} LTC)</i>

🎖 <b>Rank:</b> ${userRank} (XP: ${xp})
${progressBar}
ׂ╰┈➤ <b>Next Rank:</b> ${nextXP > 0 ? `${nextXP} XP needed` : "Max Rank"}
────────────────────
╰──╮ ⋯ ⋯ ⋯ ⋯ ⋯ ⋯  ╭──╯
    `;

    let options = {
      parse_mode: 'HTML'
    };

    if (isPrivate) {
      // Include buttons in private chat
      options.reply_markup = {
        inline_keyboard: [
          [
            { text: '💸 Deposit', callback_data: 'preview' },
            { text: '💵 Withdraw', callback_data: 'preview' }
          ],
          [
            { text: '🔙 Back', callback_data: 'preview' },
            { text: '🎁 Rewards', callback_data: 'rewards' }
          ]
        ]
      };
    } else {
      // In group chat, reply to the user's message
      options.reply_to_message_id = msg.message_id;
    }

    // Send the profile message to the user
    await bot.sendMessage(chatId, profileMessage, options);
  } catch (error) {
    console.error(`Error in handleProfileCommand: ${error.message}`);
    await bot.sendMessage(chatId, '❌ Error: Unable to load profile information.');
  }
}

// Helper function to calculate rank and progress towards the next rank
function calculateRankAndProgress(xp) {
    const ranks = [
        { rank: "Unranked", xp: 0, emoji: "😶‍🌫️" },
        { rank: "Bronze I", xp: 80, emoji: "🥉" },
        { rank: "Bronze II", xp: 300, emoji: "🥉" },
        { rank: "Bronze III", xp: 550, emoji: "🥉" },
        { rank: "Iron I", xp: 875, emoji: "🔩" },
        { rank: "Iron II", xp: 2187, emoji: "🔩" },
        { rank: "Iron III", xp: 3375, emoji: "🔩" },
        { rank: "Emerald I", xp: 7000, emoji: "✧💚✧" },
        { rank: "Emerald II", xp: 12550, emoji: "✧💚✧" },
        { rank: "Emerald III", xp: 26888, emoji: "✧💚✧" },
        { rank: "Ruby I", xp: 40332, emoji: "🌹" },
        { rank: "Ruby II", xp: 75420, emoji: "🌹" },
        { rank: "Ruby III", xp: 142545, emoji: "🌹" },
        { rank: "Sapphire I", xp: 249454, emoji: "💠" },
        { rank: "Sapphire II", xp: 461490, emoji: "💠" },
        { rank: "Sapphire III", xp: 692236, emoji: "💠" },
        { rank: "Platinum I", xp: 1038354, emoji: "💿" },
        { rank: "Platinum II", xp: 1860730, emoji: "💿" },
        { rank: "Platinum III", xp: 3334428, emoji: "💿" },
        { rank: "Diamond I", xp: 5975294, emoji: "💎" },
        { rank: "Diamond II", xp: 19220261, emoji: "💎" },
        { rank: "Diamond III", xp: 34385046, emoji: "💎" },
        { rank: "Diamond IV", xp: 61618002, emoji: "💎" },
        { rank: "Immortal", xp: 100000000, emoji: "⛩️" }
    ];

    let currentRank = "Unranked";
    let nextRank = "Max Rank";
    let progress = 0;
    let nextXP = 0;

    for (let i = 0; i < ranks.length; i++) {
        if (xp >= ranks[i].xp) {
            currentRank = `${ranks[i].rank} ${ranks[i].emoji}`;
            if (i + 1 < ranks.length) {
                nextRank = ranks[i + 1].rank;
                progress = (xp - ranks[i].xp) / (ranks[i + 1].xp - ranks[i].xp);
                nextXP = ranks[i + 1].xp - xp;
            } else {
                progress = 1.0; // Max rank achieved
                nextXP = 0;
            }
        } else {
            break;
        }
    }
    return { rank: currentRank, nextRank: nextRank, progress, nextXP };
}

// Helper function to create a visual progress bar
function createProgressBar(progress) {
    const totalBars = 15; // Total length of the progress bar
    const filledBars = Math.round(totalBars * progress);
    const emptyBars = totalBars - filledBars;
    const filledBarChar = '▰';
    const emptyBarChar = '▱';

    return `${filledBarChar.repeat(filledBars)}${emptyBarChar.repeat(emptyBars)}`;
}

// Helper function to calculate countdown
function getCountdown() {
    const targetDate = new Date('2024-12-14T00:00:00-07:00').getTime();
    const now = Date.now();
    const timeDifference = targetDate - now;

    const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDifference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));

    return `${days}d ${hours}h ${minutes}m`;
}

// Initialize user in database if they don't exist
async function initializeUser(userId, username = 'Unknown') {
    try {
        const result = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [userId]);
        if (result.rows.length === 0) {
            await pool.query(
                'INSERT INTO users (telegram_id, username, balance, xp, level) VALUES ($1, $2, $3, $4, $5)',
                [userId, username, 0, 0, 1]
            );
            console.log(`[${new Date().toISOString()}] New user initialized - ID: ${userId}, Username: ${username}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error initializing user:', error);
        return false;
    }
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        // Check if user exists
        const userExists = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [userId]);
        
        if (userExists.rows.length === 0) {
            // Initialize new user
            await pool.query(`
                INSERT INTO users (telegram_id, username, first_name, last_name)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (telegram_id) DO NOTHING`,
                [userId, msg.from.username, msg.from.first_name, msg.from.last_name]
            );
            console.log(`[${new Date().toISOString()}] New user initialized - ID: ${userId}, Username: ${msg.from.username || 'Unknown'}, Name: ${msg.from.first_name || ''} ${msg.from.last_name || ''}`);
        }

        // Get time until launch
        const timeUntilLaunch = getCountdown();

        const welcomeMessage = `
╭──╯ ⋯ ⋯ ⋯ ⋯ ⋯ ⋯  ╰──╮
───── ⋆⋅HVYSTAKES⋅⋆ ─────
👋 Welcome,

HVYSTAKES is a NEW, Community-Focused
Dice Lounge created for live games with other
people! Enjoy a variety of games
and compete with your friends!

❓<b>How To Play:</b>

    <b>↳ You can't yet!</b> <i>We're currently hard at work,
    looking forward to bringing you the
    best experience possible!</i> <b>Stay tuned.</b>

<i>➠ However, you'll want to request our
    group, @HVYSTAKESLOUNGE.</i>

⏰ <b>Time Until Launch:</b> ${timeUntilLaunch}
<b>───────────────────────</b>
<b>╰──╮ ⋯ ⋯ ⋯ ⋯ ⋯ ⋯ ⋯ ╭──╯</b>
        `;  


        await bot.sendMessage(chatId, welcomeMessage, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '👤 Profile', callback_data: 'profile' }],
                    [{ text: '🎲 Games', callback_data: 'preview' }]
                ]
            }
        });
    } catch (error) {
        console.error('Error in /start:', error);
        await bot.sendMessage(chatId, '❌ An error occurred. Please try again later.');
    }
});

// Handle /profile command
bot.onText(/\/profile/, async (msg) => {
    await handleProfileCommand(msg.chat.id, msg.from.id, msg);
});

// Handle callback queries
bot.on('callback_query', async (query) => {
    try {
        if (query.data === 'profile') {
            await handleProfileCommand(query.message.chat.id, query.from.id, query.message, true);
        } else if (query.data === 'rewards') {
            // Special handling for rewards preview
            const rewardsPreview = `
╭──╯ ⋯ ⋯ ⋯ ⋯ ⋯ ⋯  ╰──╮
<b>───── ⋆⋅REWARDS⋅⋆ ─────</b>
🎁 <b>Available Rewards:</b>

💫 <i>Weekly Bonus</i>
   ┗━ Claim once per week!

🔥 <i>XP Boosters</i>
   ┗━ 2x & 3x XP Tokens

⭐️ <i>Level Up Bonuses</i>
   ┗━ Rewards for reaching new ranks

💎 <i>Wager Rakeback</i>
   ┗━ Earn while you play

🤝 <i>Referral Program</i>
   ┗━ Share & earn together

🎯 <i>Losing Streak Protection</i>
   ┗━ We've got your back

🎫 <i>Free Raffle Entries</i>
   ┗━ Free chances to win
<b>───────────────────────</b>
<b>╰──╮ ⋯ ⋯ ⋯ ⋯ ⋯ ⋯ ⋯ ╭──╯</b>`;

            await bot.editMessageText(rewardsPreview, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔒 Available at Launch!', callback_data: 'preview' }]
                    ]
                }
            });
            await bot.answerCallbackQuery(query.id);
        } else if (query.data === 'preview') {
            await bot.answerCallbackQuery(query.id, {
                text: '🔒 This feature will be available when HVYSTAKES launches! Join @HVYSTAKESLOUNGE to stay updated.',
                show_alert: true
            });
        }
    } catch (error) {
        console.error('Error handling callback query:', error);
        try {
            await bot.answerCallbackQuery(query.id, {
                text: 'An error occurred. Please try again.',
                show_alert: true
            });
        } catch (err) {
            console.error('Error sending error callback:', err);
        }
    }
});

console.log('Preview Bot is running...');
