import type { Response, Request } from "express";
import type { IContribution, IParticipant, IState, IWithdraw } from "./types";
import dotenv from 'dotenv';

// Инициализация dotenv
dotenv.config();

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// NocoDB API базовый URL и API ключ
const NOCODB_BASE_URL = process.env.NOCODB_BASE_URL


const NOCODB_API_KEY = process.env.NOCODB_API_KEY; // Замените на ваш NocoDB API ключ

const headers = {
  'xc-token': NOCODB_API_KEY,
  'Content-Type': 'application/json'
};

// IDs таблиц в NocoDB
const GLOBAL_STATE_TABLE_ID = process.env.GLOBAL_STATE_TABLE_ID; // Замените на ID вашей таблицы глобального состояния
const PARTICIPANTS_TABLE_ID = process.env.PARTICIPANTS_TABLE_ID; // Замените на ID вашей таблицы участников
const WITHDRAW_TABLE_ID = process.env.WITHDRAW_TABLE_ID; // Замените на ID вашей таблицы участников

// Эндпоинт для получения вебхуков из NocoDB
app.post('/withdraw', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    // Проверка на наличие и соответствие заголовка Authorization
    if (!authHeader || authHeader !== `Bearer ${process.env.SECRET}`) {
      console.log('on auth error', authHeader)
      return res.status(403).json({ error: 'Forbidden: Invalid or missing Authorization header' });
    }

    const [data] = req.body?.data?.rows;
    console.log('Получен вебхук вывода:', data);

    // Проверяем, является ли взнос интеллектуальным
    await processWithdraw(data);
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Ошибка при обработке вебхука:', error);
    res.status(500).send('Ошибка');
  }
});


// Эндпоинт для получения вебхуков из NocoDB
app.post('/contribution', async (req: Request, res: Response) => {
  try {
    const [data] = req.body?.data?.rows;
    console.log('Получен вебхук взноса:', data);
    console.log("req.headers", req.headers)
    const authHeader = req.headers.authorization;

    // Проверка на наличие и соответствие заголовка Authorization
    if (!authHeader || authHeader !== `Authorization ${process.env.SECRET}`) {
      console.log('on auth error')
      return res.status(403).json({ error: 'Forbidden: Invalid or missing Authorization header' });
    }

    // Проверяем, является ли взнос интеллектуальным
    if (data.type === 'интеллектуальный') {
      await processIntellectual(data);
    } else if (data.type === 'имущественный') {
      await processPropertual(data);
    } else {
      console.error('Неизвестный тип взноса')
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Ошибка при обработке вебхука:', error);
    res.status(500).send('Ошибка');
  }
});

async function processWithdraw(newWithdraw: IWithdraw) {
  console.log('newWithdraw', newWithdraw)
  const participant = await getParticipant(newWithdraw.participant.Id)
  console.log("old participant: ", participant)
  
  const balance = participant.intellectual_contributions - participant.withdrawed
  
  if (balance < newWithdraw.amount){
    console.log('not available balance')
    return
  }
    
  const remain = balance - newWithdraw.amount
  
  participant.share_balance -= newWithdraw.amount
  participant.withdrawed += newWithdraw.amount
  console.log("new participant: ", participant)
  await updateParticipant(participant)
  
  let globalState = await getGlobalState();
  console.log("old globalState: ", globalState);
  globalState.total_shares -= newWithdraw.amount;
  globalState.total_withdrawed += newWithdraw.amount;
  console.log("new globalState: ", globalState);
  await updateGlobalState(globalState);
  
  newWithdraw.processed = true
  await updateWithdraw(newWithdraw)
  
}

async function processPropertual(newContribution: IContribution) {
  try {
    console.log('on processPropertual');
    const contributionAmount = newContribution.amount;
    
    // 1. Получаем глобальное состояние
    let globalState = await getGlobalState();
    console.log("globalState: ", globalState);
    
    //2. Добавляем взнос в глобальное состояние
    globalState.total_shares += contributionAmount;
    globalState.total_contributions += contributionAmount;
    globalState.total_property_contributions += contributionAmount;
    await updateGlobalState(globalState);
    
    console.log("new total_shares: ", globalState.total_shares)
    
    //3. Получаем всех участников
    let participants = await getParticipants();
    console.log("participants:", participants);

        
    //4. Обновляем share_balance участника, сделавшего новый имущественный взнос
    const participantId = newContribution.participant.Id;
    const participant = participants.find((p: {Id: number, name: string}) => p.Id === participantId);

    if (!participant) {
      throw new Error(`Участник с ID ${participantId} не найден`);
    }

    //4.1. Увеличиваем его share_balance на сумму взноса
    participant.share_balance += contributionAmount;
    participant.property_contributions += contributionAmount;
    participant.total_contributions += contributionAmount;
    
    await updateParticipant(participant)

  } catch(e) {
    console.error('Ошибка при обновлении вознаграждений:', e);
  }
}

// Основная функция перерасчёта вознаграждений
async function processIntellectual(newContribution: IContribution) {
  try {
    console.log('on processIntellectual');

    // 1. Получаем глобальное состояние
    let globalState = await getGlobalState();
    console.log("globalState: ", globalState);

    // 2. Получаем всех участников
    let participants = await getParticipants();
    console.log("participants:", participants);

    // 3. Рассчитываем сумму распределения (168% от суммы взноса)
    const contributionAmount = newContribution.amount;
    const distributionAmount = contributionAmount * 1.618;
    console.log("distributionAmount: ", distributionAmount);

    // 4. Обновляем накопленные вознаграждения всех участников
    let cumulativeRewardPerShare = globalState.cumulative_reward_per_share || 0;
    let totalShares = globalState.total_shares || 0;
    console.log('totalShares: ', totalShares)
    
    if (totalShares > 0) {
      // 4.1. Вычисляем delta для текущего распределения
      const delta = distributionAmount / totalShares;
      console.log("delta: ", delta);

      // 4.2. Обновляем cumulative_reward_per_share для будущих распределений
      cumulativeRewardPerShare += delta;

      // 4.3. Обновляем pending_rewards и reward_per_share_last для всех участников
      await updateParticipantsRewards(participants, cumulativeRewardPerShare, globalState.cumulative_reward_per_share);

      // 4.4. Обновляем total_rewards_distributed
      globalState.total_rewards_distributed = globalState.total_rewards_distributed || 0 + distributionAmount;
    
      globalState.total_shares += contributionAmount + distributionAmount;
    
    } else {
      // Если totalShares равно 0, то не делаем распределение
      globalState.total_shares += contributionAmount;
      console.log("totalShares равно 0, распределение не производится");
    }

    // 5. Обновляем share_balance участника, сделавшего новый взнос
    const participantId = newContribution.participant.Id;
    //получаем participants повторно, т.к. мы могли им уже обновить балансы распределения
    let participants2 = await getParticipants();
    console.log("participants:", participants2);

    
    const participant = participants2.find((p: {Id: number, name: string}) => p.Id === participantId);

    if (!participant) {
      throw new Error(`Участник с ID ${participantId} не найден`);
    }

    // 5.1. Увеличиваем его share_balance на сумму взноса
    participant.share_balance += contributionAmount;
    participant.intellectual_contributions += contributionAmount;
    participant.total_contributions += contributionAmount;
    
    // 6. Сохраняем обновления
    await updateParticipant(participant);
    
    globalState.cumulative_reward_per_share = cumulativeRewardPerShare;
    globalState.total_contributions += contributionAmount;
    globalState.total_intellectual_contributions += contributionAmount;
    await updateGlobalState(globalState);

    // 7. Записываем изменения в лог
    // await logChanges(newContribution);

    console.log('Перерасчет завершен успешно');

  } catch (error) {
    console.error('Ошибка при перерасчете вознаграждений:', error);
  }
}

// Вспомогательная функция для получения глобального состояния
async function getGlobalState(): Promise<IState> {
  const response = await axios.get(`${NOCODB_BASE_URL}/api/v2/tables/${GLOBAL_STATE_TABLE_ID}/records`, { headers });
  let [globalState] = response.data.list;
  return globalState;
}

// Вспомогательная функция для получения списка участников
async function getParticipants(): Promise<IParticipant[]> {
  const response = await axios.get(`${NOCODB_BASE_URL}/api/v2/tables/${PARTICIPANTS_TABLE_ID}/records`, { headers });
  return response.data.list;
}

// Вспомогательная функция для получения списка участников
async function getParticipant(id: number): Promise<IParticipant> {
  const response = await axios.get(`${NOCODB_BASE_URL}/api/v2/tables/${PARTICIPANTS_TABLE_ID}/records/${id}`, { headers });
  return response.data;
}

// Вспомогательная функция для обновления вознаграждений участников
async function updateParticipantsRewards(participants: IParticipant[], newCumulativeRewardPerShare: number, oldCumulativeRewardPerShare: number) {
  for (const participant of participants) {
    const shareBalance = participant.share_balance || 0;
    
    const rewardPerShareLast = participant.reward_per_share_last || 0;
    const pendingRewards = participant.pending_rewards || 0;

    // Вычисляем накопленные вознаграждения
    const participantDelta = newCumulativeRewardPerShare - rewardPerShareLast;
    const rewardAmount = shareBalance * participantDelta;
    console.log('\n')
    console.log('participant Id:', participant.Id);
    console.log('participantDelta: ', participantDelta)
    
    console.log("old shareBalance: ", shareBalance)
    console.log("new shareBalance: ", shareBalance + rewardAmount)
    console.log("pendingRewards: ", pendingRewards)
    
    console.log('rewardAmount: ', rewardAmount)
    
    console.log('new_pending_rewards:', pendingRewards + rewardAmount);
    console.log('old_cumulativeRewardPerShare:', oldCumulativeRewardPerShare);
    console.log('new_cumulativeRewardPerShare:', newCumulativeRewardPerShare);
    console.log('\n')
    
    // Обновляем pending_rewards и reward_per_share_last участника
    await axios.patch(`${NOCODB_BASE_URL}/api/v2/tables/${PARTICIPANTS_TABLE_ID}/records`, 
      [{
        Id: participant.Id,
        pending_rewards: pendingRewards + rewardAmount,
        reward_per_share_last: newCumulativeRewardPerShare,
        share_balance: shareBalance + rewardAmount,
      }]
    , { headers });
  }
}

// Вспомогательная функция для обновления данных участника
async function updateParticipant(participant: IParticipant) {
  // Убираем поля CreatedAt и UpdatedAt с помощью деструктуризации
  const { CreatedAt, UpdatedAt, ...rest } = participant;
  
  // Отправляем PATCH запрос с оставшимися данными
  await axios.patch(
    `${NOCODB_BASE_URL}/api/v2/tables/${PARTICIPANTS_TABLE_ID}/records`,
    [{ ...rest }], // Передаем только оставшиеся поля
    { headers }
  );
}


// Вспомогательная функция для обновления данных участника
async function updateWithdraw(withdraw: IWithdraw) {
  // Убираем поля CreatedAt и UpdatedAt с помощью деструктуризации
  const { CreatedAt, UpdatedAt, ...rest } = withdraw;
  
  // Отправляем PATCH запрос с оставшимися данными
  await axios.patch(
    `${NOCODB_BASE_URL}/api/v2/tables/${WITHDRAW_TABLE_ID}/records`,
    [{ ...rest }], // Передаем только оставшиеся поля
    { headers }
  );
}


// Вспомогательная функция для обновления глобального состояния
async function updateGlobalState(globalState: IState) {
  const { CreatedAt, UpdatedAt, ...rest } = globalState;
  
  await axios.patch(`${NOCODB_BASE_URL}/api/v2/tables/${GLOBAL_STATE_TABLE_ID}/records`, 
    [{
      ...rest
    }]
  , { headers });
}

// Вспомогательная функция для записи изменений в лог
// async function logChanges(newContribution: IContribution) {
//   await axios.post(`${NOCODB_BASE_URL}/api/v2/tables/${LOG_TABLE_ID}/records`, 
//     [{
//       description: `Перерасчет вознаграждений после интеллектуального взноса на сумму ${newContribution.amount} от участника с ID ${newContribution.participant.Id}`
//     }]
//   , { headers });
// }



app.listen(4500, () => {
  console.log('Сервер запущен на порту 4500');
});

