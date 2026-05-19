import { generateStrategy } from '../../server/services/sessionAnalysis.js'

describe('generateStrategy', () => {
  it('includes complaint warning when complaints pending', () => {
    const strategies = generateStrategy(
      { complaint_status: '有未处理投诉', problem_type: '限制' },
      { level: 'medium' },
      null,
      null
    )
    expect(strategies.some(s => s.text.includes('投诉'))).toBe(true)
  })

  it('includes freeze hint for frozen accounts', () => {
    const strategies = generateStrategy(
      { problem_type: '资金冻结' },
      { level: 'high' },
      null,
      null
    )
    expect(strategies.some(s => s.text.includes('95017'))).toBe(true)
  })
})
