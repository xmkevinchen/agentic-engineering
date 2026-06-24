#!/bin/sh
# check-dag.sh <plan> <validate|ready> [ledger] — F-054 Phase-1 DAG linter + ready-set.
#
# OPT-IN: only acts on a plan with `dag: true` frontmatter. A plan without it is a legacy
# linear plan — validate is a no-op (exit 0), so the DAG runtime never silently
# misinterprets an existing id-less plan as a graph (Doodlestein-strategic).
#
#   validate : graph well-formedness — every node has `id:`; `depends:` reference existing
#              ids; ACYCLIC (Kahn topo sort); every auto-node (`human-gate: false`) has a
#              runnable check (`Expected files:`); no `backend: workflow`
#              on a node (node backend ∈ {subagent, agent_teams}; workflow = orchestrator
#              level, F-030). Exit 0 ok | 1 violation (reason on stderr).
#   ready    : print ids of nodes whose `depends:` are ALL `pass` in the NODE_STATE ledger
#              and that are not themselves `pass`/`in_progress`. Root nodes ready on empty
#              ledger. NODE_STATE is the orchestrator's scheduling ledger ONLY — the node
#              VERDICT is re-derived from disk by check-node.sh, never from this file.
set -u

PLAN="${1:?usage: check-dag.sh <plan> <validate|ready> [ledger]}"
MODE="${2:?usage: check-dag.sh <plan> <validate|ready> [ledger]}"
LEDGER="${3:-}"
[ -f "$PLAN" ] || { echo "fail: plan not found: $PLAN" >&2; exit 1; }

# OPT-IN sentinel.
if ! grep -qiE '^dag:[[:space:]]*true[[:space:]]*$' "$PLAN"; then
  [ "$MODE" = validate ] && echo "legacy: not a dag plan (no 'dag: true')"
  exit 0
fi

case "$MODE" in
  validate)
    awk '
    function trim(s){ gsub(/^[[:space:]]+|[[:space:]]+$/,"",s); return s }
    /^##[[:space:]]/ { insteps=($0 ~ /^##[[:space:]]+Steps([[:space:]]|$)/)?1:0; innode=0; next }
    /^### /   { innode = insteps?1:0; cur=""; next }
    innode && /^id:[[:space:]]/        { v=$0; sub(/^id:[[:space:]]*/,"",v); cur=trim(v); n++; ids[n]=cur; seen[cur]=1; next }
    innode && cur!="" && /^depends:[[:space:]]/      { v=$0; sub(/^depends:[[:space:]]*/,"",v); gsub(/[\[\]]/,"",v); gsub(/,/," ",v); deps[cur]=trim(v); next }
    innode && cur!="" && /^human-gate:[[:space:]]/   { v=$0; sub(/^human-gate:[[:space:]]*/,"",v); hg[cur]=trim(v); next }
    innode && cur!="" && /^Expected files:[[:space:]]*[^[:space:]]/ { harness[cur]=1; next }
    innode && cur!="" && /^backend:[[:space:]]*workflow/ { badbackend[cur]=1; next }
    END {
      if (n==0){ print "fail: dag plan but no nodes with id:" > "/dev/stderr"; exit 1 }
      for(i=1;i<=n;i++) indeg[ids[i]]=0
      for(i=1;i<=n;i++){
        id=ids[i]
        if(badbackend[id]){ print "fail: node " id " backend: workflow illegal (use subagent|agent_teams; workflow=orchestrator level)" > "/dev/stderr"; exit 1 }
        if(hg[id]=="false" && !harness[id]){ print "fail: auto-node " id " has no runnable check (need Expected files:)" > "/dev/stderr"; exit 1 }
        m=split(deps[id],d," ")
        for(j=1;j<=m;j++){
          if(d[j]=="") continue
          if(!seen[d[j]]){ print "fail: node " id " depends on unknown id: " d[j] > "/dev/stderr"; exit 1 }
          indeg[id]++; adj[d[j]]=adj[d[j]] " " id
        }
      }
      qn=0
      for(i=1;i<=n;i++){ if(indeg[ids[i]]==0) queue[++qn]=ids[i] }
      head=1; processed=0
      while(head<=qn){
        u=queue[head++]; processed++
        m=split(adj[u],a," ")
        for(j=1;j<=m;j++){ if(a[j]=="") continue; indeg[a[j]]--; if(indeg[a[j]]==0) queue[++qn]=a[j] }
      }
      if(processed!=n){ print "fail: cycle detected (" processed "/" n " nodes orderable)" > "/dev/stderr"; exit 1 }
      print "ok: dag valid (" n " nodes)"
    }
    ' "$PLAN"
    ;;
  ready)
    awk -v ledger="$LEDGER" '
    function trim(s){ gsub(/^[[:space:]]+|[[:space:]]+$/,"",s); return s }
    /^##[[:space:]]/ { insteps=($0 ~ /^##[[:space:]]+Steps([[:space:]]|$)/)?1:0; innode=0; next }
    /^### /   { innode = insteps?1:0; cur=""; next }
    innode && /^id:[[:space:]]/  { v=$0; sub(/^id:[[:space:]]*/,"",v); cur=trim(v); n++; ids[n]=cur; next }
    innode && cur!="" && /^depends:[[:space:]]/ { v=$0; sub(/^depends:[[:space:]]*/,"",v); gsub(/[\[\]]/,"",v); gsub(/,/," ",v); deps[cur]=trim(v); next }
    END {
      if(ledger!=""){ while((getline line < ledger)>0){ if(line ~ /^NODE_STATE[[:space:]]/){ s=line; sub(/^NODE_STATE[[:space:]]*/,"",s); ci=index(s,":"); k=trim(substr(s,1,ci-1)); val=trim(substr(s,ci+1)); state[k]=val } } }
      nready=0; allpass=1
      for(i=1;i<=n;i++){
        id=ids[i]
        if(state[id]!="pass") allpass=0
        if(state[id]=="pass") continue        # done — skip
        if(state[id]=="gate") continue        # human-escalated (cap-exhausted/judge): NOT auto-ready; blocks the frontier until a human resolves it
        # fail / in_progress / pending fall through = re-runnable when deps are pass.
        # fail = retry (bounded by the work loop per-node iter/cap, which yields gate).
        # in_progress = a node interrupted mid-run is RE-PICKED on resume (crash-safe).
        rdy=1; m=split(deps[id],d," ")
        for(j=1;j<=m;j++){ if(d[j]=="") continue; if(state[d[j]]!="pass"){ rdy=0; break } }
        if(rdy){ print id; nready++ }
      }
      # Machine-distinguishable terminal signals (codex P2-3): caller never infers.
      if(nready>0) exit 0
      if(allpass){ print "__DONE__"; exit 0 }
      print "__BLOCKED__"; exit 3
    }
    ' "$PLAN"
    ;;
  *) echo "usage: check-dag.sh <plan> <validate|ready> [ledger]" >&2; exit 2 ;;
esac
