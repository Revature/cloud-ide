# Cloud IDE
Orchestration for provisioning cloud development environments (theia, gitpod, kasm) via API, including security configuration, user management, workspace management, custom scripts, and machine image configuration.

## Repo Structure
cloud-ide  
|- backend - *(python FastAPI monolith, controlling all major application fuctionality)*  
|- frontend - *(NextJS frontend, with application interactivity and SSO sign-in)*  
|- monitoring - *(Monitoring with Promtail, Loki, cAdvisor, Prometheus, and Grafana)*  
|- orchestration - *(Deployment orchestration and configuration with DockerCompose)*  
|- proxy - *(NGINX web server and proxy for all communications)*

## Deployments and Environments
- main - [Production Environment](https:ide.revature.com) - live user facing
- demo - [Demo Environment](https:demo-ide.revature.com) - Revature internal testing
- dev - [Development Environment](https:dev-ide.revature.com) - Application developmet testing environment

## Repository Branching
- New development or changes should be made to a feature branch following the ```feat-<feature_name>``` pattern. Linting and build testing workflows will be triggered.
- Features should be merged to the ```dev``` branch by pull request. This will require a single reviewer, and trigger artifact build and deployment workflows, with orchestrated deployment to the [Development Environment](https:dev-ide.revature.com).
- Releases to the demo environment should proceed from ```dev``` to ```demo``` with a pull request that will require a single reviewer, and trigger artifact build and deployment workflows, with orchestrated deployment to the [Demo Environment](https:demo-ide.revature.com).
- Releases to the production environment should proceed from ```demo``` to ```main``` with a pull request that will require two reviewers, and trigger artifact build and deployment, with orchestrated deployment to the [Production Environment](https:ide.revature.com).