import * as core from '@actions/core'
import path from 'path'
import fs from 'fs'
import tmp from 'tmp'
import { Vars } from './main'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import {
  ContainerDefinition, // eslint-disable-line import/named
  TaskDefinition, // eslint-disable-line import/named
  KeyValuePair // eslint-disable-line import/named
} from '@aws-sdk/client-ecs'

declare const process: {
  env: {
    GITHUB_WORKSPACE: string
    RUNNER_TEMP: string
    AWS_REGION: string
  }
}

async function getAWSAccountId(): Promise<string> {
  const response = await new STSClient({}).send(
    new GetCallerIdentityCommand({})
  )

  return String(response.Account)
}

async function generateSecretArn(secretName: string): Promise<string> {
  const accountId = await getAWSAccountId()
  return `arn:aws:ssm:${process.env.AWS_REGION}:${accountId}:parameter${secretName}`
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function updateTaskDef(
  taskDefinitionFile: string,
  containerName: string,
  prefix: string,
  environmentVariables: Vars,
  secrets: Vars,
  allowRemoval: boolean
): Promise<void> {
  core.debug(
    `task definition file: ${taskDefinitionFile} and container name: ${containerName}`
  )

  // Parse the task definition
  const taskDefPath = path.isAbsolute(taskDefinitionFile)
    ? taskDefinitionFile
    : path.join(process.env.GITHUB_WORKSPACE, taskDefinitionFile)
  if (!fs.existsSync(taskDefPath)) {
    throw new Error(
      `Task definition file does not exist: ${taskDefinitionFile}`
    )
  }
  const taskDefContentsStr = fs.readFileSync(taskDefPath, 'utf8')
  const taskDefContents: TaskDefinition = JSON.parse(taskDefContentsStr)

  if (!Array.isArray(taskDefContents.containerDefinitions)) {
    throw new Error(
      'Invalid task definition format: containerDefinitions section is not present or is not an array'
    )
  }
  const containerDef = taskDefContents.containerDefinitions.find(
    (element: ContainerDefinition) => element.name === containerName
  )
  if (!containerDef) {
    throw new Error(
      'Invalid task definition: Could not find container definition with matching name'
    )
  }

  if (allowRemoval) {
    containerDef.environment = []
    containerDef.secrets = []
  }

  if (!containerDef.environment) {
    containerDef.environment = []
  }

  if (!containerDef.secrets) {
    containerDef.secrets = []
  }

  for (const key in environmentVariables) {
    const name = key
    const value = environmentVariables[key]

    const variableDef = containerDef.environment.find(
      (e: KeyValuePair) => e.name === name
    )
    if (variableDef) {
      // If found, update
      variableDef.value = value
      core.debug(`updating secret ${name} in task definition`)
    } else {
      // Else, create
      core.debug(`creating secret ${name} in task definition`)
      containerDef.environment.push({ name, value })
    }
  }

  for (const name in secrets) {
    const valueFrom = await generateSecretArn(prefix + name)

    const variableDef = containerDef.secrets.find(
      (e: KeyValuePair) => e.name === name
    )
    if (variableDef) {
      // If found, update
      core.debug(`updating secret ${name} in task definition`)
      variableDef.valueFrom = valueFrom
    } else {
      // Else, create
      core.debug(`creating secret ${name} in task definition`)
      containerDef.secrets.push({ name, valueFrom })
    }
  }

  // Write out a new task definition file
  const updatedTaskDefFile = tmp.fileSync({
    tmpdir: process.env.RUNNER_TEMP,
    prefix: 'task-definition-',
    postfix: '.json',
    keep: true,
    discardDescriptor: true
  })
  const newTaskDefContents = JSON.stringify(taskDefContents, null, 2)
  core.debug(newTaskDefContents)

  fs.writeFileSync(updatedTaskDefFile.name, newTaskDefContents)
  core.setOutput('task-definition', updatedTaskDefFile.name)
}
