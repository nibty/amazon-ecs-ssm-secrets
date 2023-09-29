# Amazon ECS SSM Secrets

Theis action syncs the GitHub environment variables and secrets to AWS SSM Parameter Store and updates ECS Task Definition with the new values.

```yaml
- name: Sync secrets and env vars to AWS SSM Parameter store
  uses: nibty/amazon-ecs-ssm-secrets@main
  with:
    prefix: /$PROJECT_NAME/
    secrets: ${{ toJSON(secrets) }}
    environment-variables: ${{ toJSON(vars) }}
    ignore-pattern: '(github_token|AWS_.*|ACTIONS_.*)'
    task-definition: task-definition.json
    container-name: $PROJECT_NAME
    allow-removal: true
```
