import * as core from '@actions/core'
import Ssm from 'aws-sdk/clients/ssm'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const environmentVariables = core.getInput('environment-variables', {
      required: false
    })
    const secrets = core.getInput('secrets', { required: false })
    const prefix = core.getInput('prefix', { required: false })

    const ssm = new Ssm()

    if (environmentVariables) {
      let parsedEnvironmentVariables = [];
      try {
        parsedEnvironmentVariables = JSON.parse(environmentVariables)
      } catch (e) {
        throw new Error('environment-variables must be a valid JSON object')
      }

      for (const key in parsedEnvironmentVariables) {
        const envName = prefix + key
        core.debug(`putting ${envName} into SSM`)

        const value = parsedEnvironmentVariables[key]
        ssm.putParameter({
          Name: envName,
          Value: value,
          Overwrite: true,
          Type: 'String'
        })
      }
    }

    if (secrets) {
      let parsedSecrets = [];
      try {
        parsedSecrets = JSON.parse(secrets)
      } catch (e) {
        throw new Error('secrets must be a valid JSON object')
      }

      for (const key in parsedSecrets) {
        if (key == 'github_token') {
          continue
        }

        const secretName = prefix + key
        core.debug(`putting secret ${secretName} into SSM`)

        const value = parsedSecrets[key]
        ssm.putParameter({
          Name: secretName,
          Value: value,
          Overwrite: true,
          Type: 'SecureString'
        })
      }
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
