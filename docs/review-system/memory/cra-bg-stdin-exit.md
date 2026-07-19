---
name: cra-bg-stdin-exit
description: "CRA(react-scripts start)를 백그라운드로 띄우면 컴파일 직후 \"process exited too early\"로 죽는 문제와 해결"
metadata: 
  node_type: memory
  type: project
  originSessionId: de48dcfa-ebe3-472b-9995-f88a992f82b6
---

`react-scripts start`(CRA)를 백그라운드로 실행하면 컴파일 성공 직후 프로세스가 종료됨. 출력: "The build failed because the process exited too early. This probably means the system ran out of memory or someone called `kill -9`".

**원인**: react-scripts start가 인터랙티브 stdin을 resume하고, stdin이 EOF/닫히면(백그라운드 실행 시) 'end' 이벤트로 스스로 exit함. 메모리 문제 아님.

**해결**: stdin을 계속 열어둔다.
```
tail -f /dev/null | PORT=3000 BROWSER=none npm start
```
포트 점유 확인은 `lsof -ti :3000 -sTCP:LISTEN`. 다른 프로젝트(spotview)가 3000~3002 점유하는 경우 있음.
