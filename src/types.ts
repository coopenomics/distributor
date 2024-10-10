export interface IParticipant {
  Id: number
  name: string
  reward_per_share_last: number
  pending_rewards: number
  intellectual_contributions: number
  property_contributions: number
  total_contributions: number
  share_balance: number
  withdrawed: number
  CreatedAt?: Date
  UpdatedAt?: Date
}

export interface IState {
  Id: number
  cumulative_reward_per_share: number
  total_rewards_distributed: number
  total_contributions: number
  total_intellectual_contributions: number
  total_property_contributions: number
  total_shares: number
  total_withdrawed: number
  CreatedAt?: Date
  UpdatedAt?: Date
}

export interface IContribution {
  Id: number
  type: 'интеллектуальный' | 'имущественный'
  amount: number
  participant: {
    Id: number
    name: string
  }
}

export interface IWithdraw {
  amount: number
  participant: {
    Id: number
    name: string
  }
  transfer_data: string
  approved: boolean
  processed: boolean
  CreatedAt?: Date
  UpdatedAt?: Date
}