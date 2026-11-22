import { describe, expect, it } from 'vitest'
import { actions } from './index'

// Regression: an import cycle (actions → setup → server/documents →
// action-routes → actions) once left actions.setupWorkspace undefined in the
// bundled worker, so POST /api/actions/setupWorkspace answered 404.
describe('server actions registry', () => {
  it('registers every action as a function', () => {
    expect(Object.keys(actions).sort()).toEqual([
      'askQuestion',
      'deleteDocument',
      'retryDocumentIndexing',
      'runEvals',
      'saveEvalCase',
      'setupWorkspace',
    ])
    for (const [name, handler] of Object.entries(actions)) {
      expect(typeof handler, name).toBe('function')
    }
  })
})
