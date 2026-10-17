#!/usr/bin/env bash
# HCP Terraform の run が、指定したワークスペースのものであることを確認する。
#
# 使い方: TF_API_TOKEN=... hcp-verify-run-workspace.sh <org> <workspace-name> <hcp-run-id>
#
# - ワークスペース名 → ワークスペース ID を取得する
# - run が属するワークスペース ID を取得し、一致を確認する
# - 一致しなければ、非0で終了する
# - GITHUB_OUTPUT があれば、workspace_id / run_status を出力する
set -euo pipefail

ORG="${1:?org is required}"
WS_NAME="${2:?workspace name is required}"
RUN_ID="${3:?HCP run id is required}"
: "${TF_API_TOKEN:?TF_API_TOKEN is required}"

api() {
  curl -fsS \
    -H "Authorization: Bearer ${TF_API_TOKEN}" \
    -H "Content-Type: application/vnd.api+json" \
    "https://app.terraform.io/api/v2/$1"
}

WS_ID="$(api "organizations/${ORG}/workspaces/${WS_NAME}" | jq -r '.data.id // empty')"
if [ -z "$WS_ID" ]; then
  echo "::error::HCP workspace not found: ${ORG}/${WS_NAME}"
  exit 1
fi

RUN_JSON="$(api "runs/${RUN_ID}")"
RUN_WS_ID="$(jq -r '.data.relationships.workspace.data.id // empty' <<<"$RUN_JSON")"
RUN_STATUS="$(jq -r '.data.attributes.status // empty' <<<"$RUN_JSON")"

echo "HCP workspace: ${WS_NAME} (${WS_ID})"
echo "HCP run: ${RUN_ID} (workspace: ${RUN_WS_ID:-unknown}, status: ${RUN_STATUS:-unknown})"

if [ "$RUN_WS_ID" != "$WS_ID" ]; then
  echo "::error::HCP run ${RUN_ID} does not belong to workspace ${WS_NAME}"
  exit 1
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  {
    echo "workspace_id=${WS_ID}"
    echo "run_status=${RUN_STATUS}"
  } >> "$GITHUB_OUTPUT"
fi