import { ref } from 'vue'
import { getDateStringFromNow } from '@/calculator/date'
import type { Tournament } from '@/types/types'

export const tournament = ref<Tournament>({
  name: '',
  numTables: 0,
  startTime: getDateStringFromNow(7, 9),
  categories: [
    {
      name: '',
      shortName: '',
      entriesPerGrpMain: 3,
      entriesPerGrpRemainder: 4,
      entries: [],
      groups: [],
      durationMinutes: 0,
      knockoutRounds: [],
      numQualifiedPerGroup: 0
    }
  ]
})
