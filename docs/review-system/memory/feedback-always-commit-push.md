---
name: feedback-always-commit-push
description: 작업 완료하면 무조건 commit + push 까지 할 것 (두 군데서 병렬 작업 중)
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 16c5fc60-59fe-4e9c-a305-6fba04245e37
---

작업을 하면 **무조건 git commit + push 까지** 실행할 것. 형이 "커밋해줘/올려줘" 라고 따로 말하지 않아도 자동으로.

**Why:** 2026-07-03부터 형이 두 군데(다른 머신/터미널)에서 동시에 작업 중. 한쪽에서 작업하고 안 올리면 다른 쪽에서 최신 소스를 못 받아서 충돌·중복작업 발생.

**How to apply:**
- 코드 수정 작업이 끝나면 → `git add` → `git commit` (한글 컨벤셔널 메시지, 커밋 끝에 Co-Authored-By 라인) → `git push origin main`
- main 브랜치에 바로 push 하는 게 형의 워크플로우 (이 프로젝트는 solo/외주라 브랜치 안 나눔)
- 커밋 메시지는 기존 스타일 따를 것: `feat(범위): 내용` / `fix(범위): 내용`
- 단, 형이 하던 미커밋 작업(구장주 로그인 데모 등 남의 작업)을 내 작업과 섞어 커밋하지 말 것 — 내가 건드린 파일만 커밋
