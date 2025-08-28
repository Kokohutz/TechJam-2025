# EKS Service: Build, Deploy, Operate, Stop, and Delete

This README is a quick-ops guide for the **svc-backend** service on **AWS EKS**. It assumes your cluster was created with `eksctl` as **my-eks-app-01** in **ap-southeast-1**, and that your ECR repo is **svc-backend**.

> Tip: copy/paste sections into your terminal. Commands are idempotent where possible.

---

## 0) One‑time prerequisites

```bash
# Log in via AWS SSO (your profile is 'default')
aws sso login --profile default

# Set env for convenience
export AWS_PROFILE=default
export REGION=ap-southeast-1
export CLUSTER=my-eks-app-01

# (Optional) confirm kubectl context can reach the cluster
aws eks update-kubeconfig --region "$REGION" --name "$CLUSTER" --profile "$AWS_PROFILE"
kubectl get nodes
```

---

## 1) Build & push the image to ECR

```bash
# Resolve your account and ECR URI
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/svc-backend:latest"

# Login to ECR
aws ecr get-login-password --region "$REGION" \
| docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

# Ensure repo exists (safe to re-run)
aws ecr create-repository --repository-name svc-backend || true

# Build & push (Compose uses ./Dockerfile and pushes to ECR_URI)
yq -i '
  .services."svc-backend".build.context = "." |
  .services."svc-backend".build.dockerfile = "Dockerfile" |
  .services."svc-backend".image = strenv(ECR_URI)
' docker-compose.yml

docker compose build svc-backend
docker compose push  svc-backend
```

---

## 2) Generate K8s YAML from docker-compose (kompose)

> You already converted once; here are the canonical commands if you need to re-generate.

```bash
# Recreate clean conversion input
docker compose config --no-interpolate > docker-compose.resolved.yml

# Strip v2-only bits and keep only real services
yq -oy 'del(.name, .profiles, .secrets, .configs)
  | .services = (.services.services // .services)
  | .services |= with_entries(select((.value|has("image")) or (.value|has("build"))))
' docker-compose.resolved.yml > docker-compose.kompose.yml

# Kompose (Deployment + Service)
mkdir -p k8s
kompose convert -f docker-compose.kompose.yml -o k8s/ --controller deployment
ls k8s
```

If a `*-networkpolicy.yaml` file appears with an outdated apiVersion, you can delete that file—it’s not required for this app.

---

## 3) Deploy / Update on EKS

```bash
# Use the ECR image in the Deployment
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/svc-backend:latest"
DEPLOY=k8s/svc-backend-deployment.yaml
SERVICE=k8s/svc-backend-service.yaml

yq -i '.spec.template.spec.containers[0].image = strenv(ECR_URI)' "$DEPLOY"
yq -i '.spec.template.spec.containers[0].ports[0].containerPort = 8002' "$DEPLOY"
yq -i '.spec.ports[0].targetPort = 8002' "$SERVICE"

# Expose publicly (optional): type LoadBalancer on port 80
yq -i '.spec.type = "LoadBalancer" | .spec.ports[0].port = 80' "$SERVICE"

# Create/ensure namespace and apply
kubectl create namespace myapp --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n myapp -f "$DEPLOY" -f "$SERVICE"

# Wait for rollout
kubectl rollout status -n myapp deploy/svc-backend
```

### Get the public URL
```bash
kubectl get svc -n myapp svc-backend -o jsonpath='{.status.loadBalancer.ingress[0].hostname}{"\n"}'
# curl it
curl -I "http://$(kubectl get svc -n myapp svc-backend -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')/"
```

---

## 4) Operate

### Logs / exec
```bash
# Logs
kubectl logs -n myapp -l io.kompose.service=svc-backend --tail=200 -f

# Shell
POD=$(kubectl get pod -n myapp -l io.kompose.service=svc-backend -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it -n myapp "$POD" -- sh
```

### Restart / rollback
```bash
# Restart deployment
kubectl rollout restart deploy/svc-backend -n myapp

# Check history & undo
kubectl rollout history deploy/svc-backend -n myapp
kubectl rollout undo    deploy/svc-backend -n myapp --to-revision=1
```

### Pause / resume **the service**
```bash
# Pause (scale to 0 pods)
kubectl scale deploy/svc-backend -n myapp --replicas=0

# Resume (scale back up, e.g. to 1)
kubectl scale deploy/svc-backend -n myapp --replicas=1
```

> Note: The LoadBalancer (ELB/NLB) continues to exist and may incur cost even if replicas are 0.

### Port-forward (without a LoadBalancer)
```bash
kubectl port-forward -n myapp deploy/svc-backend 8002:8002
# open http://127.0.0.1:8002
```

---

## 5) Delete only the app (keep the cluster)

```bash
# Delete the Service (removes the external LoadBalancer)
kubectl delete svc -n myapp svc-backend

# Delete the Deployment (removes pods)
kubectl delete deploy -n myapp svc-backend

# Optionally delete the whole namespace
kubectl delete namespace myapp
```

---

## 6) **Shut down OR delete the cluster**

### Option A — “Shut down” to reduce spend (keep the cluster control plane)
*Scale worker nodes to zero.* This keeps the EKS control plane (still billed by AWS), but stops node costs and workloads.

```bash
# See managed nodegroups
eksctl get nodegroup --cluster "$CLUSTER" --region "$REGION"

# Example: scale a nodegroup to zero
eksctl scale nodegroup --cluster "$CLUSTER" --region "$REGION" \
  --name <your-nodegroup-name> --nodes 0

# To re-start later, scale back up (e.g. 2 nodes)
eksctl scale nodegroup --cluster "$CLUSTER" --region "$REGION" \
  --name <your-nodegroup-name> --nodes 2
```

> ⚠️ Even with nodes at 0, the EKS control plane and any external load balancers or EBS volumes still incur charges. Consider deleting Services of type `LoadBalancer` as well:
```bash
kubectl delete svc -n myapp svc-backend
```

### Option B — **Delete the cluster completely** (no EKS charges)
This removes the control plane, nodegroups, and all CloudFormation stacks created by `eksctl`.

```bash
# Make sure you’ve deleted LoadBalancer Services first to release ELBs:
kubectl delete svc -n myapp svc-backend || true

# Delete the cluster (this can take several minutes)
eksctl delete cluster --region "$REGION" --name "$CLUSTER"
```

**Optional cleanup after cluster deletion:**
```bash
# Delete the ECR repository (removes all images)
aws ecr delete-repository --repository-name svc-backend --force --region "$REGION"

# Remove kube context entries (optional, local only)
kubectl config delete-context $(kubectl config get-contexts -o name | grep "$CLUSTER") || true
kubectl config delete-cluster  $(kubectl config get-clusters | grep "$CLUSTER") || true
kubectl config unset users.$(kubectl config view -o jsonpath='{.users[*].name}' | tr ' ' '\n' | grep "$CLUSTER" || true) || true
```

> If deletion ever gets stuck, check CloudFormation for stacks named like `eksctl-<cluster>-*` and delete stuck resources. Also ensure no leftover NLB/ALB or EBS volumes exist.

---

## 7) ECR housekeeping (optional)

```bash
# List images
aws ecr list-images --repository-name svc-backend --region "$REGION" \
  --query 'imageIds[*]' --output table

# Delete untagged digests
for d in $(aws ecr list-images --repository-name svc-backend --region "$REGION" \
  --filter tagStatus=UNTAGGED --query 'imageIds[].imageDigest' --output text); do
  aws ecr batch-delete-image --repository-name svc-backend --region "$REGION" \
    --image-ids imageDigest=$d || true
done
```

---

## 8) Quick troubleshooting

```bash
# CrashLoopBackOff? See last run and current
kubectl logs -n myapp -l io.kompose.service=svc-backend --previous --tail=200
kubectl logs -n myapp -l io.kompose.service=svc-backend --tail=200

# Pod stuck Pending? Check events and CNI
kubectl describe pod -n myapp -l io.kompose.service=svc-backend | sed -n '/Events/,$p'
kubectl get events -A --sort-by=.lastTimestamp | tail -n 50

# Force a clean redeploy
kubectl rollout restart deploy/svc-backend -n myapp
```

---

**That’s it!** Use *Option A* to pause the environment, or *Option B* to remove it entirely and stop EKS charges.
