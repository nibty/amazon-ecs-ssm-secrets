/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core'
import * as main from '../src/main'

// Mock the GitHub Actions core library
const debugMock = jest.spyOn(core, 'debug')
const getInputMock = jest.spyOn(core, 'getInput')
const setFailedMock = jest.spyOn(core, 'setFailed')
// const setOutputMock = jest.spyOn(core, 'setOutput')

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

jest.mock('@aws-sdk/client-ssm')

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sets the env vars', async () => {
    getInputMock.mockImplementation((name: string): string => {
      switch (name) {
        case 'environment-variables':
          return '{"ENV_ONE":"env one value","ENV_TWO":"env two value"}'
        case 'prefix':
          return '/test-please-delete/'
        case 'ignore-pattern':
          return '(github_token|AWS_ROLE_TO_ASSUME)'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    expect(debugMock).toHaveBeenNthCalledWith(
      1,
      `putting /test-please-delete/ENV_ONE into SSM`
    )
    expect(debugMock).toHaveBeenNthCalledWith(
      3,
      `putting /test-please-delete/ENV_TWO into SSM`
    )
  })

  it('sets a failed status', async () => {
    getInputMock.mockImplementation((name: string): string => {
      switch (name) {
        case 'environment-variables':
          return 'asdsad'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'environment-variables must be a valid JSON object'
    )
  })

  it('sets the secrets', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation((name: string): string => {
      switch (name) {
        case 'secrets':
          return '{"SECRET_ONE":"secret one value","SECRET_TWO":"secret two value","github_token":"should ignore this one"}'
        case 'prefix':
          return '/test-please-delete/'
        case 'ignore-pattern':
          return '(github_token|AWS_ROLE_TO_ASSUME)'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(debugMock).toHaveBeenNthCalledWith(
      1,
      `putting secret /test-please-delete/SECRET_ONE into SSM`
    )
    expect(debugMock).toHaveBeenNthCalledWith(
      3,
      `putting secret /test-please-delete/SECRET_TWO into SSM`
    )
  })

  it('sets a failed status for secrets', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation((name: string): string => {
      switch (name) {
        case 'secrets':
          return 'asdsadad'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'secrets must be a valid JSON object'
    )
  })
})
