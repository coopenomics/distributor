// refresh.ts

import axios from 'axios';
import type { IState } from './types';

// NocoDB API базовый URL и API ключ
const NOCODB_BASE_URL = 'https://db.coopenomics.world'; // Обновите при необходимости
const NOCODB_API_KEY = 'iZQVzIpCPBU3Y2auYQGskrueBPtj3nkiUWgtjnvY'; // Замените на ваш NocoDB API ключ

const headers = {
  'xc-token': NOCODB_API_KEY,
  'Content-Type': 'application/json',
};

// IDs таблиц в NocoDB
const GLOBAL_STATE_TABLE_ID = 'mgz4zwjl6qwiw1u'; // Замените на ID вашей таблицы глобального состояния
const PARTICIPANTS_TABLE_ID = 'mfigch0rlgz4cqa'; // Замените на ID вашей таблицы участников
const CONTRIBUTIONS_TABLE_ID = 'mmcm3kr9ddwrtz5'; // Замените на ID вашей таблицы взносов
const WITHDRAW_TABLE_ID = 'm1knfvrdoxeu5nt'

// Интерфейсы для структур данных
interface GlobalState {
  Id: number;
  cumulative_reward_per_share: number;
  total_rewards_distributed: number;
  total_contributions: number;
  total_intellectual_contributions: number;
  total_property_contributions: number;
}

interface Participant {
  Id: number;
  name: string;
  intellectual_contributions: number;
  property_contributions: number;
  total_contributions: number;
  pending_rewards: number;
  total_rewards_received: number;
  reward_per_share_last: number;
  total_assets: number;
}

// Функция для обнуления глобального состояния
async function resetGlobalState() {
  try {
    // Получаем глобальное состояние
    const response = await axios.get(`${NOCODB_BASE_URL}/api/v2/tables/${GLOBAL_STATE_TABLE_ID}/records`, { headers });
    const [globalStateData] = response.data.list;

    if (!globalStateData) {
      console.log('Глобальное состояние не найдено, пропускаем сброс.');
      return;
    }

    const globalState: IState = {
      Id: globalStateData.Id,
      cumulative_reward_per_share: 0,
      total_rewards_distributed: 0,
      total_contributions: 0,
      total_intellectual_contributions: 0,
      total_property_contributions: 0,
      total_shares: 0,
      total_withdrawed: 0
    };

    // Обнуляем поля глобального состояния
    await axios.patch(
      `${NOCODB_BASE_URL}/api/v2/tables/${GLOBAL_STATE_TABLE_ID}/records`,
      [
        {
          Id: globalState.Id,
          cumulative_reward_per_share: globalState.cumulative_reward_per_share,
          total_rewards_distributed: globalState.total_rewards_distributed,
          total_contributions: globalState.total_contributions,
          total_intellectual_contributions: globalState.total_intellectual_contributions,
          total_property_contributions: globalState.total_property_contributions,
          total_shares: globalState.total_shares,
        },
      ],
      { headers }
    );

    console.log('Глобальное состояние успешно обнулено.');
  } catch (error) {
    console.error('Ошибка при обнулении глобального состояния:', error);
  }
}

// Функция для удаления всех записей взносов
async function deleteAllContributions() {
  try {
    // Получаем все записи взносов
    const response = await axios.get(
      `${NOCODB_BASE_URL}/api/v2/tables/${CONTRIBUTIONS_TABLE_ID}/records`,
      { headers }
    );
    const contributions = response.data.list;

    if (contributions.length === 0) {
      console.log('Нет записей взносов для удаления.');
      return;
    }

    // Собираем массив Id для удаления
    const idsToDelete = contributions.map((contribution: any) => ({ Id: contribution.Id }));

    // Удаляем записи
    await axios.delete(`${NOCODB_BASE_URL}/api/v2/tables/${CONTRIBUTIONS_TABLE_ID}/records`, {
      headers,
      data: idsToDelete,
    });

    console.log('Все записи взносов успешно удалены.');
  } catch (error) {
    console.error('Ошибка при удалении записей взносов:', error);
  }
}


// Функция для удаления всех записей взносов
async function deleteAllWithdraws() {
  try {
    // Получаем все записи взносов
    const response = await axios.get(
      `${NOCODB_BASE_URL}/api/v2/tables/${WITHDRAW_TABLE_ID}/records`,
      { headers }
    );
    const withdraws = response.data.list;

    if (withdraws.length === 0) {
      console.log('Нет записей взносов для удаления.');
      return;
    }

    // Собираем массив Id для удаления
    const idsToDelete = withdraws.map((contribution: any) => ({ Id: contribution.Id }));

    // Удаляем записи
    await axios.delete(`${NOCODB_BASE_URL}/api/v2/tables/${WITHDRAW_TABLE_ID}/records`, {
      headers,
      data: idsToDelete,
    });

    console.log('Все записи взносов успешно удалены.');
  } catch (error) {
    console.error('Ошибка при удалении записей взносов:', error);
  }
}

// Функция для обнуления балансов всех пайщиков
async function resetParticipants() {
  try {
    // Получаем всех участников
    const response = await axios.get(
      `${NOCODB_BASE_URL}/api/v2/tables/${PARTICIPANTS_TABLE_ID}/records`,
      { headers }
    );
    const participantsData = response.data.list;

    if (participantsData.length === 0) {
      console.log('Нет участников для сброса балансов.');
      return;
    }

    const participants: Participant[] = participantsData.map((participantData: any) => ({
      Id: participantData.Id,
      name: participantData.name,
      intellectual_contributions: 0,
      property_contributions: 0,
      total_contributions: 0,
      pending_rewards: 0,
      total_rewards_received: 0,
      reward_per_share_last: 0,
      share_balance: 0,
      withdrawed: 0,
    }));

    // Обновляем каждого участника
    for (const participant of participants) {
      await axios.patch(
        `${NOCODB_BASE_URL}/api/v2/tables/${PARTICIPANTS_TABLE_ID}/records`,
        [
          {
            Id: participant.Id,
            intellectual_contributions: participant.intellectual_contributions,
            property_contributions: participant.property_contributions,
            total_contributions: participant.total_contributions,
            pending_rewards: participant.pending_rewards,
            total_rewards_received: participant.total_rewards_received,
            reward_per_share_last: participant.reward_per_share_last,
            share_balance: 0,
            withdrawed: 0,
          },
        ],
        { headers }
      );
    }

    console.log('Балансы всех пайщиков успешно обнулены.');
  } catch (error) {
    console.error('Ошибка при обнулении балансов пайщиков:', error);
  }
}

// Главная функция для выполнения всех операций
async function refreshAll() {
  await resetGlobalState();
  await deleteAllContributions();
  await deleteAllWithdraws();
  await resetParticipants();
}

// Запуск главной функции
refreshAll();
