# TaxOpt 의사결정 로그

**최종 갱신**: 2026-05-03
**관리 원칙**: 단일 파일 유지. 새 의사결정은 추가, 번복 시 Deprecated 섹션으로 이동, 파일명에 버전 숫자 붙이지 않음.

---

## 갱신 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-05-03 (v14) | **v0.3-A 코드 마일스톤 완전 달성** — tax_rules.js v0.3-A + tax_engine.js v0.3-A (commit dcecb4b) + Node.js 회귀 194/0 + 667/0 + selfTest 5건 AND ok + sanity 8건 ok + GitHub Pages 라이브 검증 TC-011~014 4/4 통과. KPI 100% 5자 일치 (검증팀·Claude 명세서·홈택스·Claude Code Node.js·GitHub Pages 라이브). v0.3-A 누적 산출물 영속화 (명세서 1,157줄 + xlsx 8 시트 + 모듈 스펙 1,880줄 + 작업지시서 분리본 999+1,401줄). 작업 창 #9~#12 모두 종료. v0.1 + v0.2 + v0.3-A 코드 마일스톤 모두 달성 (4/27 ~ 5/3 7일 누적). 자체 발견 짚을 부분 18건 (사용자·작업 창·Claude Code 짚음으로 모두 정정). |
| 2026-05-02 (v13) | **v0.2 코드 마일스톤 완전 달성** — tax_engine.js v0.2.0 (commit e36cb68) + Node.js 회귀 534/0 + sanity 6건 ok + GitHub Pages 라이브 검증 TC-006~010 5/5 통과. KPI 100% 5자 일치 (검증팀·Claude 명세서·홈택스·Claude Code Node.js·GitHub Pages 라이브). 작업지시서 04 영속화 (1,559줄). 작업 창 #9 종료. v0.1 + v0.2 코드 마일스톤 모두 달성 (4/27 ~ 5/2 6일 누적). 자체 발견 짚을 부분 9건 (모두 처리 또는 백로그 등록). 백로그 신규: 결과 객체 구조 명세 vs 실제 불일치 (B-032). |
| 2026-05-01 (v12) | #12 신규 — TaxOpt 본질 가치 정의 (양도세 → 통합 자산 운용 시뮬레이터). 본질 가치 4영역: 보유세·가격 전망·통합 NPV·조특법 주택수 제외. 조특법 처리 사용자 도메인 전문성 주도 분담. 백로그 B-028~B-031 신규 등록 (post-MVP) + B-007 정밀화. 의사결정 #12 단계 매핑 제거(v0.5/v0.6/v0.7/v0.8 → post-MVP P1·P2). |
| 2026-05-01 (v11) | #11 신규 — 작업 창 운영 원칙 강화 (정확성 > 속도). #5 강화 — 법령 개정 대응 아키텍처 명문화 (B-020 추적). v0.2.1 명세서 검증 통과 (TC-006~010 KPI 100%, 3자 일치). 모듈 스펙 tax_rules.md v0.2.0 영속화. 백로그 B-019~B-023 신규 5건 등록 + B-024~B-027 신규 4건 등록 권고 (작업 창 #7 §11-6 인계). 5/1 사용자 5건 운영 짚음 영속화 (법령 개정 대응·법제처 OpenAPI·정수 처리·부칙 처리·작업 창 운영 원칙). ISSUE-V02-001 정정 완료(룩업 테이블) + ISSUE-V02-002 백로그 영속화(B-022, 1원 차이 향후 검토). 작업 창 #5·#6·#7 종료 + #8 신설 예정. |
| 2026-04-30 (v10) | #10 신규 — 시나리오 비교 1순위 정렬 지표 (D안 + 보강 4건). 백로그 B-008 처리 완료(closure). 백로그 B-009~B-018 신규 9건 등록. 입력 스키마 v0.1.2 패치 (House에 specialTaxFlags·specialTaxRequirementsMet 추가, v0.6+ 활성). 작업 창 #5(의사결정 #10 심층 검토 전용)의 검토 보고서 + v10 본문 초안 + 입력 스키마 패치 산출 |
| 2026-04-29 (v9) | #9 사후 인정 확정 — Claude Code 검증 + Node.js 회귀 테스트 67/0 통과로 tax_rules.js·tax_rules.test.js 정식 인정 |
| 2026-04-29 (v8) | #9 정정 — 작업 창 분담 원칙 명문화 (작업 창 #1-1의 .js 코드 최종 산출 금지, Claude Code 단일 책임). 작업 창 #1-1 자체 분석에 따른 정정 |
| 2026-04-29 (v7) | #5 보강(테스트 파일 *.test.js), #2 일정·산출물 진행 갱신, #9 신규(작업지시서 사후 운명 — v8에서 정정), v0.2 검증팀 옵션 A·후퇴 트리거 옵션 C·데모 케이스 5/5 이연 등 운영 결정 흡수 |
| 2026-04-28 (v6) | 작업 창 번호 체계 계층형 정정(#2→#1-1), 작업지시서 표기 통일(#1→01) |
| 2026-04-28 (v5) | #8 보강 — Code 작업지시서 위치 docs/05_code_work_orders/, "Codex"→"Code" 일괄 정정 |
| 2026-04-28 (v4) | #8 v0.1 명세서 검증 완료 + 버전별 폴더 구조 (docs/v{버전}/) |
| 2026-04-27 (v3) | #5 보강 — 모든 .js 파일은 언더바(snake_case) 명명 |
| 2026-04-27 (v2) | #7 GitHub Repo 명세 추가 |
| 2026-04-27 (v1) | 초기 작성. 의사결정 #1~#6 등록 |

---

## 현행 의사결정 (Active)

### #1. 중과 유예 처리

- **결정일**: 2026-04-27
- **결정**: 다주택 중과 유예가 종료된 상태(2026.5.10. 이후 양도)를 기본 전제로 삼는다.
- **근거**:
  - 소득세법 부칙
  - PRD 03절 "다주택자 양도소득세 중과 유예 조치가 2026년 5월 9일 예정대로 종료"
  - PRD 6-3절 대표 사례 "양도 시점: 2026.5.9. 이후"
- **세부 적용**:
  - 모든 시나리오의 양도 예정일은 2026.5.10. 이후로 가정
  - 조정대상지역 다주택자 양도 시 기본세율 + 20%p(2주택) / +30%p(3주택) 적용
  - 중과 대상 주택은 장기보유특별공제 적용 배제 (소득세법 제95조)
  - 중과 유예 경과규정, 강남3구 특례 등은 MVP에서 구현하지 않음 → issueFlag 처리
  - 양도일이 2026.5.9. 이전인 경우 입력 검증 단계에서 경고 + "전문가 검토 필요" 표시
- **영향 범위**: tax_rules.js, scenario 가정값, 입력 검증

### #2. 개발 범위와 마일스톤

- **결정일**: 2026-04-27 / 2026-04-28 (일정 갱신) / 2026-04-30 (v0.1 완료 반영)
- **결정**: A안 — 5/7 2차 발표까지 v0.1 → v0.2 → v0.3 단계적 진행.
- **이유**: PRD 5-1절 P0 핵심 메시지를 데모에서 살리기 위해서는 단일 주택 일반과세만으로 부족하며, 비과세·중과·시나리오 엔진까지 필요함.
- **버전별 범위 및 진행 상황 (2026-04-30 기준)**:

  | 버전 | 범위 | 목표일 | 상태 |
  |---|---|---|---|
  | v0.1 | 단일 주택 일반과세 계산 | 4/29(수) | ✅ 완료 (코드 + 라이브 검증) |
  | v0.2 | + 장특공 + 1세대1주택 비과세 | 5/2(토) | ⏳ 진행 중 (4/30 명세서 시작) |
  | v0.3 | + 다주택 중과 + 시나리오 엔진 + 상태전이 (의사결정 #10 적용) | 5/4(월) | ❌ 미착수 |
  | v0.4 | + 결과 화면 동적 렌더링 + 설명 문장 | 5/6(수) | ❌ 미착수 |
  | 발표 | 2차 발표 | 5/7(목) | — |

- **검증 운영 원칙**:
  - "검증팀 독립 손계산 + 외부 도구 교차검증" 패턴을 모든 버전에 적용
  - v0.1 검증: TC-001~005 5건 모두 3자 일치 (검증팀·Claude·홈택스) + Node.js 회귀 234/0 + GitHub Pages 라이브 검증 통과
  - v0.2 검증팀 가용: 4/30 오전부터 가용 (옵션 A 확정)
- **후퇴 시나리오**: 5/4 시점에 v0.3가 동작하지 않으면 즉시 v0.2로 후퇴.
- **후퇴 트리거 발동 시 권한**: 작업 창에서 트리거 발동 즉시 총괄창에 보고 → 총괄창에서 30분 내 결정 (옵션 C). 작업 창 단독 결정 금지.
- **발표 데모 케이스**: v0.3 완성 후 5/5에 결정.
- **영향 범위**: 전체 일정, 모듈 구현 순서

### #3. salePlan UI 통합 위치

- **결정일**: 2026-04-27
- **결정**: 기존 ②세대 기본 정보 카드와 ③주택별 정보 입력 카드 사이에 "②.5 양도 계획" 카드를 신설한다.
- **근거**: 사용자가 주택별 정보를 입력하기 전에 "몇 채 팔지"를 먼저 결정하는 흐름이 자연스럽고, salePlan의 fixedSaleHouseIds·excludedHouseIds가 주택 ID와 연결되므로 주택 입력 직전에 위치하는 것이 적합.
- **세부 사항**: 카드 markup 패턴(.card / .card-header / .card-body)과 기존 CSS 변수 그대로 사용. 기존 카드 ②, ③ 디자인 변경 금지.
- **진행 상황**: index.html 승격 + ②.5 카드 반영 + GitHub Pages 배포 완료 (4/28)
- **영향 범위**: index.html, input_collector.js

### #4. AI 자동 입력 기능

- **결정일**: 2026-04-27
- **결정**: 자연어 입력 → 폼 자동 채우기 기능을 5/7 데모 범위에서 제외한다.
- **이유**: PRD P0 핵심 가치에 포함되지 않으며, KPI에도 무관. 발표 시연 중 LLM이 엉뚱한 값을 뽑을 사고 위험. 계산 엔진 일정에 자원 집중 우선.
- **세부 처리**:
  - 기존 nlp-area 텍스트영역 숨김 또는 제거
  - btn-ai-extract 버튼 숨김 또는 제거
  - dummyExtract(), runAiExtract() 함수는 호출되지 않도록
  - highlightMissing(), field-error 빨간 테두리, missing-banner는 수동 입력 검증에도 유용하므로 유지
- **재검토 시점**: 5/7 이후 v0.5 단계
- **영향 범위**: index.html

### #5. 코드 파일 구조

- **결정일**: 2026-04-27 (v1) / 2026-04-27 (v3 보강 — snake_case) / 2026-04-29 (v7 보강 — 테스트 파일)
- **결정**: 계산·시나리오 관련 코드는 인라인 <script>가 아닌 별도 .js 파일로 분리. ES6 module은 사용하지 않고 비-모듈 <script src="..."> 다중 로드 방식.
- **이유**:
  - v0.3까지 가면 코드량이 600~800줄로 폭증해 단일 HTML로는 관리 한계
  - PRD 11절 KPI "규칙 테스트 통과율 95% 이상" 충족을 위해 함수가 import 가능해야 함
  - index.html과 result.html이 같은 함수를 공유하려면 별도 파일이 필수
  - ES6 module 대신 비-모듈 방식: 로컬 file:// 환경과 GitHub Pages 모두 추가 도구 없이 동작
- **파일명 명명 규칙**:
  - 코드 파일: snake_case → tax_rules.js, tax_engine.js, scenario_engine.js, input_collector.js, result_renderer.js, explanation_engine.js
  - 테스트 파일: *.test.js 접미어 → tax_rules.test.js, tax_engine.test.js, scenario_engine.test.js
  - 문서 파일: snake_case → 99_decision_log.md
- **영향 범위**: 모든 코드 파일 구조, Code 작업지시서
- **법령 개정 대응 아키텍처 (v11 강화 — 2026-05-01)**:
  - **출처**: 5/1 사용자 우려 — 법령 개정 시 코드 수정 범위 최소화 (B-020 추적)
  - **원칙 1 (단일 소스)**: 법령에 명시된 모든 숫자(임계·세율·공제율 표·연차 분기 임계)는 tax_rules.js 단일 소스에 둔다. tax_engine.js·scenario_engine.js·input_collector.js 어느 다른 모듈도 법령 숫자를 직접 보유하지 않는다.
  - **원칙 2 (룩업 테이블 우선)**: 법령 표(누진세율표·장특공 표 1·표 2)는 표 그대로 룩업 테이블 형태로 정의한다. 등차수열 산식이 표와 결과가 동치이더라도 산식 형태는 금지한다.
  - **원칙 3 (산식 흐름 분리)**: tax_rules.js는 데이터·룩업 함수만 노출한다. 13단계 산식 흐름·절사·합계는 tax_engine.js가 담당한다.
  - **적용 효과**:
    - 법령 개정(세율·공제율·임계 변경) 시 tax_rules.js만 수정. tax_engine.js 변경 없음
    - 새 단계·분기 추가 시에만 tax_engine.js 수정 (드문 빈도)
    - 향후 법제처 OpenAPI 활용 검토(B-021) 시 자동화 대상이 tax_rules.js로 한정
  - **적용 시점**:
    - v0.2.1 명세서 §0-1 사전 적용 (4/30 작업 창 #6 정정 + 5/1 일괄 정정)
    - v0.2 모듈 스펙 §1-2 인용 (5/1 작업 창 #7)
    - v0.3·v0.4·v0.5+ 모든 코드·명세서 동일 적용
  - **연관 백로그**: B-020, B-021, B-022, B-023

### #6. 산출물 영속화

- **결정일**: 2026-04-27 (v1) / 2026-04-28 (v4 보강 — 형식 다양화)
- **결정**: 모든 작업 창 산출물은 docs/ 디렉토리의 .md 파일로 사용자가 로컬에 저장하고, 안정화·검증 후 Claude.ai 프로젝트 지식에 업로드. 채팅 답변만 있는 상태를 산출물 완료로 간주하지 않음.
- **이유**:
  - 채팅 컨텍스트 한도 초과·세션 종료·실수 삭제 시 산출물 유실 위험
  - PRD 8-7절 "추적 가능성" 충족
  - 5/7 발표 자료 인용 시 파일 형태가 필요
- **영속화 형식 다양화**:
  - 문서·로그·매핑표·명세서: .md
  - 표 데이터: 구글 시트(작업) + GitHub .xlsx(영속화)
  - 발표 자료: .pptx 또는 .pdf
  - 차트·다이어그램: .png 또는 .svg
  - 코드: .js (적절한 디렉토리)
- **운영 원칙**:
  - 산출물 파일명: docs/{번호}_{작업명}.md
  - 의사결정 로그는 docs/99_decision_log.md 단일 파일 유지, 갱신 시 덮어쓰기
  - 백로그는 docs/98_backlog.md 단일 파일
  - Claude.ai 프로젝트 지식 업로드: 안정화·검증된 산출물만
- **영향 범위**: 모든 작업 창의 산출물 처리 방식

### #7. GitHub Repo 명세

- **결정일**: 2026-04-27
- **결정**: 새 GitHub repo taxopt를 신설하여 프로젝트 자산을 정리. 기존 caio-poc는 Archive 처리.
- **세부 명세**:

  | 항목 | 결정값 |
  |---|---|
  | repo 이름 | taxopt |
  | repo URL | https://github.com/ds7style/taxopt |
  | GitHub Pages URL | https://ds7style.github.io/taxopt/ |
  | 공개 여부 | Public |
  | 라이선스 | MIT |
  | 기본 브랜치 | main |
  | GitHub Pages | 활성화 (main / root) |
  | 기존 caio-poc | Archive 처리 완료 |

- **디렉토리 구조 (2026-04-30 v10 갱신 — v0.1 완료 반영)**:

taxopt/
├── README.md
├── .gitignore
├── LICENSE
├── index.html                            ← v0.5 ②.5 카드 + tax_rules.js + tax_engine.js 연결
├── js/
│   ├── tax_rules.js                      ← v0.1.1 사후 인정 확정 (#9)
│   └── tax_engine.js                     ← v0.1.1 신규 작성 (Claude Code, 234/0)
├── tests/
│   ├── tax_rules.test.js                 ← 회귀 테스트 67건
│   └── tax_engine.test.js                ← 회귀 테스트 234건
├── docs/
│   ├── v0.1/
│   │   ├── 01_calc_engine_spec.md       ← 명세서 v0.1.1
│   │   ├── 03_input_schema.md            ← 입력 스키마 v0.1.2 (#10 패치)
│   │   ├── 06_test_cases.md              ← TC-001~005 골든셋
│   │   └── modules/
│   │       ├── tax_rules.md              ← 모듈 스펙
│   │       └── tax_engine.md             ← 모듈 스펙
│   ├── 02_saleplan_ui_design.md
│   ├── 04_test_cases_manual.xlsx
│   ├── 05_code_work_orders/
│   │   ├── 01_tax_rules.md
│   │   └── 02_tax_engine.md
│   ├── 98_backlog.md                     ← B-001~B-018 추적
│   └── 99_decision_log.md                ← 본 파일 v10
└── archive/
├── 04_index_input_screen.html
└── 05_result_screen.html

- **팀 영향**: PRD 12절 git 커밋 범위 분담 그대로 유지.
- **영향 범위**: 전체 프로젝트 자산 위치, 배포 환경

### #8. v0.1 명세서 검증 완료 + 버전별 폴더 구조

- **결정일**: 2026-04-28
- **결정**:
  - v0.1.1 명세서를 v0.1 코드 구현의 기준으로 확정
  - 버전별 명세서·테스트 케이스는 docs/v{버전}/ 폴더 하위에 둔다
  - Code 작업지시서 위치는 docs/05_code_work_orders/{번호}_{작업명}.md
- **검증 결과**:
  - TC-001~005 5건 모두 검증팀 손계산·Claude 명세서·홈택스 모의계산 3자 일치
  - PRD 11절 KPI "정답 일치율 90% 이상"을 100% 달성
- **세부 사항**:
  - 13단계 파이프라인 산식 확정
  - 비조정대상지역·단일 주택·일반과세 범위
  - TC-001~005는 v0.2·v0.3 회귀 검증 골든셋
  - v0.1.0 → v0.1.1로 10건 패치(P1~P10) 반영
- **영향 범위**: 명세서·코드·검증·발표 데모 전체

### #9. 작업 창 분담 원칙 (2026-04-29 v8 정정 → v9 사후 인정 확정 반영)

- **결정일**: 2026-04-29 (v7 초안 → v8 정정 → v9 사후 인정 확정)
- **배경**: 4/28 작업 창 #1-1이 tax_rules.js와 tax_rules.test.js를 직접 산출했으나, 작업 창 #1-1 자신의 사후 분석에서 이는 Claude Code의 책임 영역을 침범한 것임이 드러남.
- **결정**: 작업 창 간 산출물 분담을 다음과 같이 명문화한다.

  | 작업 창 | 책임 산출물 | 금지 산출물 |
  |---|---|---|
  | 작업 창 #1 (명세서) | 명세서, 입력 스키마, 골든셋, 검증 결과 | 코드(.js) |
  | 작업 창 #1-1 (코드/룰 설계) | 모듈 스펙(.md), 작업지시서(.md), 의사결정 로그 갱신 | .js 코드 최종 산출 |
  | 작업 창 #5 (의사결정 검토) | 의사결정 검토 보고서, 의사결정 로그 본문 초안 | 결정 권한 (총괄창 권한) |
  | Claude Code | 실제 .js 코드 작성, 테스트 코드 작성, git 영속화 | — |

- **세부 적용**:
  - 작업 창 #1-1·#5의 .js 산출물은 참고 코드 골격(reference skeleton) 수준까지만 허용. 완성된 코드 전체 산출 금지.
  - 작업지시서는 "참고 골격 없이도" Claude Code가 단독 작성 가능하도록 충분히 상세해야 함.
  - 실제 .js 파일의 영속화(GitHub repo의 js/, tests/)는 Claude Code의 단일 책임.

- **사후 처리 (4/28 사고 정리) — 4/29 검증 통과로 확정 완료**:
  - Claude Code 4단계 점검 (회귀 테스트 어서션 분석 + 모듈 스펙 정합성 + 명세서 정합성 + 종합 보고): ✅ 통과
  - .NET IEEE 754 double 직접 연산 (PowerShell): ✅ 7개 등식 모두 eq=True int=True
  - 사용자 PC Node.js 회귀 테스트 실제 실행: ✅ 67건 통과 / 0건 실패
  - 사후 인정 확정: js/tax_rules.js와 tests/tax_rules.test.js를 v0.1 코드 자산으로 정식 인정. GitHub repo 영구 보존.

- **첫 본격 적용 사례 (2026-04-29 4/29 오후)**:
  - 작업 창 #4 (작업지시서 02 작성 전용) 신설하여 tax_engine.md 모듈 스펙 + 02_tax_engine.md 작업지시서 산출
  - Claude Code가 작업지시서 02 단독 받아 js/tax_engine.js + tests/tax_engine.test.js 신규 작성 + 자체 회귀 테스트 234/0 통과
  - GitHub Pages 라이브 검증 (사용자 콘솔 직접 호출, totalTax 98,241,000 명세서 일치)
  - 의사결정 #9 v9 정상 작동 입증

- **재발 방지**:
  - 향후 모든 작업 창은 본 #9 원칙을 따름
  - 백로그 B-006 (회귀 테스트 자동화 GitHub Actions)로 사후 인정 절차 자동화 추적

- **영향 범위**: 모든 작업 창 분담, Code 작업지시서 작성 원칙, 코드 작업 흐름

### #10. 시나리오 비교 1순위 정렬 지표 (D안 + 보강 4건)

- **결정일**: 2026-04-30
- **선행 백로그**: B-008 (2026-04-29 등록 → 본 결정으로 closure)
- **검토 출처**: 작업 창 #5 (의사결정 #10 심층 검토 전용) — 8개 측면 비교, SWOT 분석, 추가 검토(증여·보유세·조특법 특례)

- **배경**:
  - PRD 5-1 P0 메시지("순서·시점 비교로 세후 실수령액 차이 발생 + 절세 최적 조합 추천")가 시나리오 종류에 따라 정합성이 어긋남.
  - 시나리오 1(어느 1채를 팔까)에서 netAfterTaxSaleAmount 1순위는 양도가액에 종속되어 "비싼 주택을 팔라"는 무의미한 답을 산출.
  - 사용자(Gim) 4/29 우려 — "절세 최적화"라는 PRD 의도와 어긋남.
  - 시나리오 2(전부 양도, 순서 비교)와 시나리오 3(시점 분산)에서는 합계 salePrice가 동일하므로 후보 A·B·C 모두 같은 순위 산출. 쟁점은 시나리오 1에 한정.
  - 명세서 v0.1.1 §4-1은 이미 metrics 3개(totalTax, netAfterTaxSaleAmount, effectiveTaxRate)를 사전 노출하여 본 결정의 인터페이스를 마련해 둠.

- **결정**: D안(시나리오 종류별 1순위 정렬 지표 분기) 채택 + 확장성 보강 4건 채택.
  - 보강 (1): 정렬 함수 metricKey 인자 패턴 + 룰 테이블화
  - 보강 (2): 시나리오 종류 식별을 enum이 아닌 차원 태그(dimensions) 방식
  - 보강 (3): scenarioResult에 actions[]·referenceYear 메타를 v0.3부터 미리 노출
  - 보강 (4): House에 specialTaxFlags·specialTaxRequirementsMet 필드를 v0.1부터 미리 추가 (v0.6+ 활성)

- **이유**:
  - 사용자 우려 정면 대응 — 시나리오 1 무력화 문제 해소.
  - PRD 5-1·6-3 메시지 보존 — 시나리오 2·3에서 "세후 실수령액 최대" 메시지를 그대로 유지. PRD 본문 수정 불요.
  - 명세서 v0.1.1 metrics 사전 노출 작업과 100% 정합. v0.3 진입 부담 사전 감소(B-008 처리 방향에 명시된 효과).
  - 5/7 발표 D-7 시점에 분기 로직 구현 부담 적음(약 10~15줄).
  - 보강 4건은 v0.5 증여·v0.6 보유세·v0.6+ 조특법 특례주택 확장 시 데이터 모델·분기 구조 재설계를 방지하기 위한 사전 인터페이스 확장점. 누적 추가 비용 약 15~20줄.

- **세부 적용**:

  **(A) 시나리오 종류 차원 태그 식별 함수 — `classifyScenarioDimensions(salePlan)`**

```js
  {
    hasMultipleCandidates: salePlan.candidateHouseIds.length > 1
                           && salePlan.fixedSaleHouseIds.length === 0,
    hasOrderingDecision:   salePlan.targetSaleCount >= 2,
    hasTimingSpread:       salePlan.allowYearSplitting === true
                           && salePlan.targetSaleYears.length >= 2
    // (참고용 주석) v0.5+ 확장 시 추가 가능: hasGiftOption, hasHoldingTaxView
    // (참고용 주석) v0.6+ 확장 시 추가 가능: hasSpecialTaxHouse
  }
```

  **(B) 시나리오 종류 식별 룰 + 1순위 정렬 지표 매핑 (룰 테이블)**

  | 우선순위 | 식별 조건 | 시나리오 종류 | 1순위 metricKey | 정렬 방향 |
  |---|---|---|---|---|
  | 1 | hasTimingSpread === true | TYPE_3_TIMING | netAfterTaxSaleAmount (합계) | desc |
  | 2 | hasMultipleCandidates === true AND hasOrderingDecision === false | TYPE_1_WHICH_ONE | effectiveTaxRate | asc |
  | 3 | (그 외 모든 케이스) | TYPE_2_ORDER | netAfterTaxSaleAmount (합계) | desc |

  결합 케이스(시나리오 1+2+3 복합) 처리: 위 우선순위에 따라 시점 분산이 활성이면 무조건 TYPE_3_TIMING이 우선 적용된다.

  **(C) 정렬 함수 시그니처 (metricKey 인자 패턴)**

```js
  sortScenariosByMetric(scenarios, metricKey, order)
  recommendBestScenario(scenarios, salePlan)  // (A)·(B) 통합 진입점
```

  metricKey 룰 테이블은 scenario_engine.js에 상수로 보유하며 v0.5+ 신규 지표(householdNetWealthNPV 등) 추가 시 룰 테이블 한 줄 추가만으로 확장.

  **(D) 시나리오 1 보조 결정 — effectiveTaxRate 채택 (totalTax 아님)**
  
  시나리오 1에서 effectiveTaxRate를 1순위로 채택. 양도가액으로 정규화된 효율성 비교가 사용자 의도("어느 주택이 절세 효율 우수한가")에 가장 적합. totalTax는 양도가액에 약하게 결부되어(작은 주택은 세금도 작음) 절댓값 비교의 의미가 제한됨.

  **(E) scenarioResult 메타 보강 (v0.3부터)**

```js
  scenarioResult = {
    scenarioId:    string,
    scenarioType:  "TYPE_1_WHICH_ONE" | "TYPE_2_ORDER" | "TYPE_3_TIMING",
    dimensions: {
      hasMultipleCandidates: boolean,
      hasOrderingDecision:   boolean,
      hasTimingSpread:       boolean
    },
    
    // v0.5+ 확장 대비 사전 노출 — v0.3에서는 모든 actions의 type === 'sale'
    actions: [{
      type:     "sale",          // v0.5+: "sale" | "gift" | "partial_gift" | "hold"
      houseId:  string,
      year:     number,
      amount:   number,
      taxpayer: "self"           // v0.5+: "self" | "recipient"
    }],
    referenceYear:         number,    // 비교 기준 연도, v0.5+ NPV 계산 baseline
    
    metrics: {
      totalTax:              number,
      netAfterTaxSaleAmount: number,
      effectiveTaxRate:      number | null
    },
    perTransactionResults: taxResult[]  // 행위별 taxResult 배열
  }
```

  scenarioType과 dimensions 모두 노출. 결과 화면은 scenarioType 기반 캡션을 사용하고, v0.5+ 확장 시 dimensions를 활용한다.

  **(F) 결과 화면 표시 정책**

  - 비교표에 3개 지표(totalTax, netAfterTaxSaleAmount, effectiveTaxRate) 모두 컬럼으로 표시.
  - 1순위 정렬 지표 컬럼만 시각 강조(green badge 또는 굵은 글씨).
  - 표 헤더 또는 캡션에 시나리오 종류 명시(예: "TYPE_1_WHICH_ONE: 어느 1채를 양도할지 비교").

- **부수 결정**:

  | # | 항목 | 결정 |
  |---|---|---|
  | 1 | 결과 화면 지표 노출 | 3개 모두 표시 + 1순위 시각 강조 |
  | 2 | 동순위 처리(tiebreaker) | ① Σ totalTax 오름차순 → ② effectiveTaxRate 오름차순 → ③ 시나리오 ID 사전순 (재현성 보장) |
  | 3 | 시나리오 종류 사용자 직접 선택 | v0.3 미지원. salePlan 7개 필드로 자동 식별. v0.5 이후 검토 |
  | 4 | 결합 케이스 우선순위 | 시점 분산 활성 시 TYPE_3_TIMING 우선 |
  | 5 | 시나리오 1의 1순위 | effectiveTaxRate (totalTax 아님) |

- **입력 스키마 v0.1.2 패치 (본 결정과 함께 적용)**:
  - `docs/v0.1/03_input_schema.md`를 v0.1.2로 패치
  - House에 `specialTaxFlags` (선택 필드, v0.1 미사용, v0.6+ 활성) + `specialTaxRequirementsMet` (선택 필드, 동일) 추가
  - v0.1 누락 시 자동 보정값 적용 (입력 스키마 §2-4에 명시)
  - **`tax_engine.js`의 validateCaseData 자동 보정 로직은 v0.2 시점에 추가** (v0.1 회귀 안전성 보장 — TC-001~005는 두 필드 미입력 상태 그대로 통과)

- **재검토 시점**:
  - **5/4 v0.3 검증 완료 시점** — 골든셋(시나리오 종류별 1건 이상)이 모두 통과하는지
  - **5/5 발표 데모 케이스 결정 시점** — 데모 케이스의 시나리오 종류 확정, 발표 PT 보조 슬라이드 검토(B-018)
  - **6/11 최종 발표 후 회고 시점** — D안 분기가 사용자에게 자연스러웠는지 검증
  - **v0.5 진입 시점** — 증여·보유세 통합 지표(B-010 householdNetWealthNPV)와 함께 1순위 정렬 지표 재정의. NPV 할인율 가정(B-011) 결정. 지표명 일반화 리팩터(B-013) 검토
  - **v0.6 진입 시점** — 조특법 특례주택(B-014~B-017) 흡수 시 차원 태그 추가(hasSpecialTaxHouse)와 후보군 자동 축소 정책 결정

- **영향 범위**:

  | 대상 | 변경 내용 |
  |---|---|
  | js/scenario_engine.js | v0.3 신규 작성. classifyScenarioDimensions, sortScenariosByMetric, recommendBestScenario 함수. SCENARIO_METRIC_RULES 상수 |
  | js/tax_engine.js | 기존 metrics 노출 그대로 유지. v0.2 시점에 validateCaseData 자동 보정 로직 추가 |
  | docs/v0.3/01_calc_engine_spec.md | v0.3 신규 작성 |
  | docs/v0.3/modules/scenario_engine.md | v0.3 신규 작성. 본 결정의 룰 테이블·정렬 함수 계약 |
  | docs/05_code_work_orders/03_scenario_engine.md | v0.3 신규 작성 |
  | docs/v0.1/03_input_schema.md | 본 결정과 함께 v0.1.2로 패치 — House에 specialTaxFlags·specialTaxRequirementsMet 필드 추가 |
  | result.html | v0.4 동적 렌더링 시 3개 지표 컬럼 + 1순위 강조 + 시나리오 종류 캡션 적용 |
  | 발표 PT (PRD) | 본문 수정 불요. 5/5 발표 데모 케이스 결정 시점에 보조 슬라이드 검토(B-018) |
  | 백로그 | B-008 closure. B-009~B-018 신규 등록 |

- **연관 백로그**:
  - 처리 완료: B-008 (의사결정 #10으로 closure)
  - 신규 등록: B-009(validateCaseData 단축형 노출), B-010~B-017(작업 창 #5 제안 8건), B-018(5/7 발표 PT 보조 슬라이드)

### #11. 작업 창 운영 원칙 강화 (정확성 > 속도)

- **결정일**: 2026-05-01
- **결정**: 모든 작업 창에 "정확성 > 속도" 원칙 적용. 시스템 프롬프트에 일정·시간 제약 표기 금지(예외: 사용자가 명시적으로 일정 압박 동의 시). 자체 검증 5건 필수. 본 관제탑은 작업 창 산출본 받은 후 검증 갭 점검 6건 수행. 일정 관리 권한은 사용자 자율, 본 관제탑은 순서·우선순위 권고만 제공.
- **출처**: 5/1 사용자 짚음 — "작업 시간을 주면, 급하게 졸속으로 처리할 가능성은 없나?"
- **전제**: 4/27~5/1 운영 점검 결과 작업 창 #7에서 졸속 신호 발견 (백로그 ID 매핑 오류 3건, 11분 만에 821줄 산출). 작업 창 #5·#6는 졸속 신호 없음. 작업 창 #7만 명백한 졸속 신호.
- **이유**:
  - 작업 창 시스템 프롬프트의 일정·시간 제약 표기가 졸속 처리 위험 유발
  - 일정 압박 → 사실 확인 부족 → 백로그·법령·의사결정 ID 임의 추측
  - 정정 횟수가 운영 가치 (산출 시간 단축은 운영 가치 없음)
- **세부 적용 — 작업 창 시스템 프롬프트 원칙**:
  - 일정·시간 제약 표기 금지 (예외: 사용자가 명시적으로 일정 압박 동의 시)
  - "정확성 > 속도" 원칙 명시
  - 자체 검증 단계 5건 필수:
    - 백로그 ID 정합성 (본문 정독 후 매핑)
    - 법령 조항 인용 (PDF 본문 정독 후 인용)
    - 인용 자료 정독 검증 (명세서·모듈 스펙·의사결정 본문)
    - 자체 sanity 케이스 실행 (가능한 경우)
    - 자체 발견 짚을 부분 명시 (산출 작성 중 발견)
- **세부 적용 — 본 관제탑 검증 갭 점검 책임**:
  - 작업 창 산출본 받은 후 자동 점검 6건 필수:
    - 백로그 ID 매핑
    - 법령 조항 인용
    - 변경 이력
    - 룩업 테이블·임계값 정합성
    - 자체 검증 결과 점검
    - 졸속 신호 점검 (산출 시간·정정 횟수·디테일 깊이)
  - 점검 결과 사용자께 보고 후 정정 진행
- **세부 적용 — 일정 관리 권한**:
  - 일정 관리 권한은 사용자에게 있음
  - 본 관제탑은 일정 표 미작성, 진행 시점 사용자 자율
  - 본 관제탑은 작업 순서·우선순위 권고는 적극 제공 (어느 순서로 처리, 차단 사항·병렬 가능 여부)
  - 단, 시간 명시("X시까지", "Y분 안에" 등) 금지
  - 시간 압박 = 부담 → 졸속 처리 위험 → 금지
  - 순서 권고 = 효율 → 작업 흐름 명확화 → 적극
- **적용 시점**:
  - 작업 창 #8 (5/1 또는 그 이후 작업지시서 03)부터 시스템 프롬프트에 "운영 원칙" 섹션 자동 포함
  - 향후 v0.3·v0.4·v0.5+ 모든 작업 창 동일 적용
- **적용 효과 검증** (5/1 작업 창 #7 정정에서):
  - 졸속 신호 0건 (이전 산출 백로그 매핑 오류 3건)
  - 자체 검증 충실도 매우 높음 (백로그 정합성·인용 위치·8건 자체 평가)
  - 자체 발견 짚을 부분 2건 (§5-2, §1-2)
  - 정정 정합성 100%
- **영향 범위**: 모든 작업 창 시스템 프롬프트, 본 관제탑 검증 패턴, 작업 창 #8 신설부터 적용
- **연관**: 의사결정 #5 강화(코드 아키텍처) #6(영속화 의무) #9(작업 창 분담)와 보완 관계

### #12. TaxOpt 본질 가치 정의 (양도세 → 통합 자산 운용 시뮬레이터)

- **결정일**: 2026-05-01
- **출처**: 5/1 사용자 짚음 — "이 솔루션의 진짜 가치는 보유 주택을 계속 소유함으로써 발생하는 보유세(재산세+종합부동산세), 소유 주택의 가격 변동전망까지 고려되어야 발휘돼" + 추가 짚음 "조특법 주택수 제외 요건의 운영 핵심성"
- **결정**: TaxOpt의 본질 가치를 양도소득세 단독 최적화에서 **다주택자 자산 운용 시뮬레이터**로 재정의. 본질 가치는 양도소득세 + 보유세(재산세·종부세) + 가격 변동 전망 + 조특법 주택수 제외 요건의 통합 고려를 통한 세후 자산 가치 + 미래 현금흐름 최적화.
- **이유**:
  - 양도세 최소 ≠ 자산 가치 최대 (양도세 작은 주택을 팔고 가격 상승 큰 주택 보유 시 자산 가치 최대화 가능)
  - 종부세 누진성으로 보유 주택 수 결정이 양도세 외 세부담에 큰 영향
  - 가격 변동 전망이 5~10년 단위로 자산 가치를 결정
  - 조특법 주택수 제외 요건 = 다주택 중과 회피·1세대1주택 비과세 적용 진입의 핵심 레버 (자산 운용 최적화의 본질 도구)
  - MVP가 본질 가치의 일부만 다루지만, 본질 가치 명문화로 향후 확장 방향 명확
- **MVP 범위 (v0.1~v0.4)**:
  - 양도소득세 단독 + 시나리오 비교 (현재 그대로)
  - MVP 한계 명시: 보유세·가격 전망·조특법 주택수 제외 미고려
  - issueFlag: 시나리오 결과에 "보유세·가격 변동·조특법 미반영" 안내
- **확장성 아키텍처 사전 준비 (MVP 단계)**:
  - 입력 스키마: 보유세 입력 필드 + 조특법 제외 가능 여부 필드 자리 표시 (v0.4까지 미사용, post-MVP 활성화)
  - scenario_engine.js: 시나리오 결과 객체에 holdingTaxImpact·priceForecastImpact·specialActExclusion 필드 (v0.4까지 0 또는 false, post-MVP 채움)
  - 시나리오 비교 지표: netAfterTaxSaleAmount → 향후 netAfterTaxAssetValue로 확장 가능 구조 (의사결정 #10의 metricKey 인자화로 사전 대비됨)
- **본격 서비스화 단계 (post-MVP, 시점 미정)**:
  - 우선순위 P1 (본질 가치 핵심):
  - 보유세 모듈 (재산세 + 종부세) — B-028
  - 통합 시뮬레이션 (NPV 또는 IRR) — B-030
  - 조특법 본격 처리 (주택수 제외 요건 + 한시 특례 + 다중 특례 우선순위) — B-014, B-015, B-016, B-017
  - 우선순위 P2:
    - 가격 변동 전망 모듈 — B-029
    - 시나리오 비교 지표 본질 가치 전환 — B-031
  - 단계 정의(v0.5/v0.6 등)는 5/7 발표 후 비즈니스 환경·피드백을 종합하여 사용자가 결정
  - 본 관제탑은 단계 매핑 결정 권한 미보유 (의사결정 #11 운영 원칙)
- **세부 적용**:
  - 5/7 발표 PT 보조 슬라이드(B-018)에 본질 가치 정의 + MVP 한계 + 향후 로드맵 명시 (5/5 처리)
  - PRD 갱신 (v1.1) — TaxOpt 정의 확장 (post-MVP 진입 시점 처리)
  - 백로그 B-028~B-031 신규 등록 + B-007 정밀화 (5/1 영속화)
  - post-MVP 단계의 명세서·코드는 본 의사결정을 단일 진본으로 인용
- **조특법 처리 분담 (5/1 결정)**:
  - 본 관제탑은 조특법 정밀 인지 부족 (조항·요건·메커니즘 개념 수준)
  - 사용자(조세심판원 운영팀장 + 세법 도메인 약 20년 경력)가 조특법 정밀 처리 주도
  - 본 관제탑은 운영·구조·아키텍처 측면 지원 (조특법 룰셋 분리·시나리오 엔진 설계 등)
- **영향 범위**:
  - PRD v1.1 (post-MVP 진입 시점)
  - 발표 PT 메시지 (5/7)
  - post-MVP 모든 코드·명세서·시스템 프롬프트
  - 입력 스키마 v0.5 (보유세·조특법 입력 필드 추가)
  - scenario_engine.js v0.5 (통합 NPV/IRR 시뮬레이션)
  - 시나리오 비교 지표 (의사결정 #10) 본질 가치 전환 시점 갱신
- **연관 백로그**: B-010, B-011, B-014, B-015, B-016, B-017, B-020, B-021, B-023, B-028, B-029, B-030, B-031
- **연관 의사결정**: #2 (개발 범위) — post-MVP 단계 정의 확장. #10 (시나리오 비교 지표) — 본질 가치 전환 시점 갱신.

---

## 폐기/번복된 의사결정 (Deprecated)

### #9 (v7 초안 — 2026-04-29 v8에서 정정)
- **초안**: "작업지시서가 다른 작업 창에서 선행 완성된 경우 검증·확인 작업으로 재해석"
- **폐기 사유**: 사후 처리만 다루고 예방 원칙이 빠져 있음. 작업 창 #1-1의 자체 분석에서 더 근본적인 분담 원칙이 필요함을 확인.
- **대체**: v8 #9 (작업 창 분담 원칙 명문화 + 사후 처리 절차 통합)

---

## 일정·진행 상황 (참고용 — 변경 빈번하므로 의사결정 로그 갱신 트리거 아님)

### 산출물 진행 상황 (2026-05-03 기준)

| 산출물 | 상태 | 영속화 |
|---|---|---|
| 의사결정 로그 v11 | ✅ 본 파일 | docs/99_decision_log.md (Claude.ai 갱신 필요) |
| 백로그 (B-001~B-027) | ✅ 작성 완료 (B-019~B-023 5/1 등록 + B-024~B-027 신규 등록 권고) | docs/98_backlog.md |
| salePlan UI 설계 | ✅ 검증 통과 | docs/02_saleplan_ui_design.md |
| 수기 정답 양식 v0.1 | ✅ 작성 완료 | docs/04_test_cases_manual.xlsx |
| 수기 정답 양식 v0.2 | ✅ 작성 완료 (8 시트) | docs/v0.2/04_test_cases_manual.xlsx |
| 명세서 v0.1.1 | ✅ 검증 통과 (3자 일치) | docs/v0.1/01_calc_engine_spec.md |
| **명세서 v0.2.1** | **✅ 검증 통과 (3자 일치, KPI 100%, 5/1)** | **docs/v0.2/01_calc_engine_spec.md** |
| 입력 스키마 v0.1.2 | ✅ 의사결정 #10 패치 적용 | docs/v0.1/03_input_schema.md |
| **입력 스키마 v0.2.0** | **✅ 작성 완료** | **docs/v0.2/03_input_schema.md** |
| TC-001~005 골든셋 | ✅ 검증 통과 (100%) | docs/v0.1/06_test_cases.md |
| **TC-006~010 골든셋** | **✅ 검증 통과 (100%, 5/1)** | **docs/v0.2/06_test_cases.md** |
| tax_rules 모듈 스펙 v0.1.1 | ✅ 작성 완료 | docs/v0.1/modules/tax_rules.md |
| **tax_rules 모듈 스펙 v0.2.0** | **✅ 작성 완료 (820줄, 5/1 작업 창 #7 산출 + 보강 정정)** | **docs/v0.2/modules/tax_rules.md** |
| tax_engine 모듈 스펙 v0.1.1 | ✅ 작성 완료 | docs/v0.1/modules/tax_engine.md |
| **tax_engine 모듈 스펙 v0.2.1** | **✅ 작성 완료 (5/1 일괄 정정)** | **docs/v0.2/modules/tax_engine.md** |
| tax_rules.js v0.1.1 | ✅ selfTest ok: true + Node.js 67/0 | js/tax_rules.js |
| tax_rules.test.js | ✅ 회귀 테스트 67건 | tests/tax_rules.test.js |
| tax_engine.js v0.1.1 | ✅ Node.js 234/0 + GitHub Pages 라이브 검증 통과 | js/tax_engine.js |
| tax_engine.test.js | ✅ 회귀 테스트 234건 | tests/tax_engine.test.js |
| 작업지시서 01 (tax_rules) | ✅ 검증 활용 완료 | docs/05_code_work_orders/01_tax_rules.md |
| 작업지시서 02 (tax_engine) | ✅ Claude Code 신규 작성 활용 완료 | docs/05_code_work_orders/02_tax_engine.md |
| **작업지시서 03 (tax_rules·tax_engine v0.2)** | **⏳ 작업 창 #8 신설 대기 (사용자 자율 시점)** | **docs/05_code_work_orders/03_*.md (예정)** |
| index.html 승격 | ✅ ②.5 카드 + tax_rules.js + tax_engine.js 연결 + GitHub Pages 검증 | repo root |
| **작업지시서 04 (tax_engine v0.2)** | **✅ 작성 완료 (1,559줄, 5/2 작업 창 #9 산출, 자체 발견 짚을 부분 3건 + 본 관제탑 정정 1건)** | **docs/05_code_work_orders/04_tax_engine_v0_2.md** |
| **tax_engine.js v0.2.0** | **✅ Node.js 회귀 534/0 (v0.1 234 + v0.2 약 300) + selfTest ok + sanity 6건 ok + 부트스트랩 가드 4건 통과 + commit e36cb68** | **js/tax_engine.js** |
| **tax_engine.test.js v0.2** | **✅ 회귀 테스트 약 534건 (v0.1 234 + v0.2 신규 약 300, 그룹 8~13)** | **tests/tax_engine.test.js** |
| **GitHub Pages 라이브 검증 v0.2** | **✅ TC-006~010 5/5 통과 (5자 일치 KPI 100% 보존)** | **https://ds7style.github.io/taxopt/index.html** |
| **명세서 v0.3-A** | **✅ 검증 통과 (1,157줄, 5/2, 3자 일치 KPI 100%)** | **docs/v0.3/01_calc_engine_spec.md** |
| **xlsx 검증 양식 v0.3-A** | **✅ 영속화 (8 시트, 5/2)** | **docs/v0.3/04_test_cases_manual.xlsx** |
| **모듈 스펙 tax_rules.md v0.3-A** | **✅ 영속화 (1,147줄, 5/2)** | **docs/v0.3/modules/tax_rules.md** |
| **모듈 스펙 tax_engine.md v0.3-A** | **✅ 영속화 (733줄, 5/2, §A-1·§A-4 정정 적용)** | **docs/v0.3/modules/tax_engine.md** |
| **작업지시서 05 (tax_rules v0.3-A)** | **✅ 영속화 (999줄, 5/2 23:55, v0.2 분리 패턴 일관성 적용)** | **docs/05_code_work_orders/05_tax_rules_v0_3.md** |
| **작업지시서 06 (tax_engine v0.3-A)** | **✅ 영속화 (1,401줄, 5/2 23:55)** | **docs/05_code_work_orders/06_tax_engine_v0_3.md** |
| **tax_rules.js v0.3-A** | **✅ Node.js 회귀 194/0 + selfTest 5건 AND ok + commit dcecb4b** | **js/tax_rules.js** |
| **tax_engine.js v0.3-A** | **✅ Node.js 회귀 667/0 + selfTest ok + sanity 8건 (TC-011·012 추가) + 부트스트랩 가드 2-A + commit dcecb4b** | **js/tax_engine.js** |
| **GitHub Pages 라이브 검증 v0.3-A** | **✅ TC-011~014 4/4 통과 (5자 일치 KPI 100% 보존)** | **https://ds7style.github.io/taxopt/index.html** |

### 일정표 (2026-05-03 기준 D-5)

| 날짜 | 핵심 작업 | 마일스톤 |
|---|---|---|
| 4/27 (월) ✅ | 의사결정 #1~#7, salePlan UI, GitHub repo, tax_rules.js v0.1, xlsx 양식 | |
| 4/28 (화) ✅ | 명세서 v0.1.1 검증 통과 (3자 일치), 영속화 일괄 (6건), index.html 승격 | 명세서 검증 완료 |
| 4/29 (수) ✅ | 의사결정 v8·v9, Claude Code 첫 도입 (검증 + 신규 작성), tax_engine.js 234/0, GitHub Pages 라이브 검증 | **v0.1 코드 완료** |
| 4/30 (목) ✅ | 의사결정 v10 (#10 신규), 백로그 B-009~B-018, 입력 스키마 v0.1.2, v0.2 명세서 작성 (작업 창 #6) | |
| 5/1 (금) ✅ | **의사결정 v11 (#11 신규 + #5 강화), 백로그 B-019~B-023 + B-024~B-027 권고, v0.2.1 명세서 검증 통과 (KPI 100%), 모듈 스펙 tax_rules.md v0.2.0** | **v0.2 명세서·모듈 스펙 단계 완료** |
| 5/1 (금) ⏳ | 작업지시서 03 작성 (작업 창 #8) + Claude Code 실행 + GitHub Pages 라이브 검증 (사용자 자율 시점) | v0.2 코드 마일스톤 (v12 갱신 트리거) |
| 5/2 (토) ✅ | **v0.2 코드 마일스톤 완전 달성 (오전) + v0.3-A 명세서·xlsx·모듈 스펙·작업지시서 영속화 (오후~자정)** | **v0.2 코드 + v0.3-A 명세 단계 완료** |
| 5/3 (일) ✅ | **v0.3-A 코드 마일스톤 완전 달성 (자정 직후, commit dcecb4b) + 라이브 검증 4/4 + 의사결정 로그 v14 갱신** | **v0.3-A 코드 마일스톤 달성** |
| 5/3 (일) 오전·오후 | v0.3-B 진입 (시나리오 엔진 + 상태전이) — 명세서 + 모듈 스펙 + 작업지시서 + 코드 | v0.3-B 진입 |
| 5/4 (월) | v0.3-B 검증 + 코드 마일스톤 (시나리오 엔진) | v0.3-B 완료 |
| 5/5 (화) | result.html 동적 렌더링, 발표 데모 케이스 결정 (B-018, 시행령 제167조의10·11 단서 회피 권고), 발표 PT 보조 슬라이드 | |
| 5/6 (수) | v0.4 통합 + **PRD 작성 (3단계 구조 — 의사결정 #12 본질 가치 정의 인용) + 발표 형식 변경 운영 영속화 일괄** | v0.4 + PRD 완료 |
| **5/7 (목)** | **2차 발표 (PRD 중심)** | **D-day** |