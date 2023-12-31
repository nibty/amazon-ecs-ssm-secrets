import * as core from '@actions/core'
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm'
import { updateTaskDef } from './task-def'

export interface Vars {
  [key: string]: string
}

const defaultVars: Vars = {}

async function wait(timer: number): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(), timer)
  })
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const environmentVariables = core.getInput('environment-variables', {
      required: false,
      trimWhitespace: true
    })
    const secrets = core.getInput('secrets', {
      required: false,
      trimWhitespace: true
    })
    const prefix = core.getInput('prefix', {
      required: false,
      trimWhitespace: true
    })
    const ignorePattern = core.getInput('ignore-pattern', { required: false })
    const taskDefinitionFile = core.getInput('task-definition', {
      required: false
    })
    const containerName = core.getInput('container-name', { required: false })
    const allowRemoval = core.getInput('allow-removal', { required: false })

    const ignoreRe = new RegExp(ignorePattern)
    const client = new SSMClient()

    let parsedEnvironmentVariables: Vars = defaultVars
    let parsedSecrets: Vars = defaultVars

    if (environmentVariables) {
      try {
        parsedEnvironmentVariables = JSON.parse(environmentVariables)
      } catch (e) {
        core.setFailed('environment-variables must be a valid JSON object')
      }

      for (const key in parsedEnvironmentVariables) {
        if (ignoreRe.test(key)) {
          core.debug(`ignoring ${key}`)
          delete parsedEnvironmentVariables[key]
          continue
        }

        const envName = prefix + key
        core.debug(`putting ${envName} into SSM`)

        const value = parsedEnvironmentVariables[key]
        const command = new PutParameterCommand({
          Name: envName,
          Value: value,
          Overwrite: true,
          Type: 'String'
        })

        const response = await client.send(command)
        core.debug(JSON.stringify(response))
        // slow the rate of insertions so aws doesn't get upset
        await wait(250)
      }
    }

    if (secrets) {
      try {
        parsedSecrets = JSON.parse(secrets)
      } catch (e) {
        core.setFailed('secrets must be a valid JSON object')
      }

      for (const key in parsedSecrets) {
        if (ignoreRe.test(key)) {
          core.debug(`ignoring ${key}`)
          delete parsedSecrets[key]
          continue
        }

        const secretName = prefix + key
        core.debug(`putting secret ${secretName} into SSM`)

        const value = parsedSecrets[key]
        const command = new PutParameterCommand({
          Name: secretName,
          Value: value,
          Overwrite: true,
          Type: 'SecureString'
        })
        const response = await client.send(command)
        core.debug(JSON.stringify(response))
        // slow the rate of insertions so aws doesn't get upset
        await wait(250)
      }
    }

    if (taskDefinitionFile && containerName) {
      await updateTaskDef(
        taskDefinitionFile,
        containerName,
        prefix,
        parsedEnvironmentVariables,
        parsedSecrets,
        allowRemoval === 'true'
      )
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
