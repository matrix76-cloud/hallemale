/* eslint-disable */
// src/pages/admin/AdminPlayersListPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import AdminFilterSummaryBar from "../../components/admin/AdminFilterSummaryBar";
import { fetchPlayersAdminView } from "../../services/adminPlayersService";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Card = styled.div`
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.04);
  overflow: hidden;
`;

const CardBody = styled.div`
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const TableWrap = styled.div`
  overflow-x: auto;
`;

const Table = styled.div`
  min-width: 1820px;
`;

const COLS = "72px 160px 210px 160px 120px 120px 260px 110px 110px 240px 160px 170px";

const Head = styled.div`
  display: grid;
  grid-template-columns: ${COLS};
  gap: 10px;
  padding: 12px 14px;
  background: #f8fafc;
  border-bottom: 1px solid #eef2f7;
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: ${COLS};
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 13px;
  color: #111827;

  &:hover {
    background: #fafbff;
  }
`;

const Cell = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
`;

const Muted = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

const Trunc = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Mono = styled.div`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 12px;
  color: #111827;
`;

const Avatar = styled.img`
  width: 42px;
  height: 42px;
  border-radius: 12px;
  object-fit: cover;
  background: #e5e7eb;
  border: 1px solid #eef2f7;
`;

const AvatarFallback = styled.div`
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: #e5e7eb;
  border: 1px solid #eef2f7;
`;

const TeamLogo = styled.img`
  width: 28px;
  height: 28px;
  border-radius: 10px;
  object-fit: cover;
  background: #e5e7eb;
  border: 1px solid #eef2f7;
  flex-shrink: 0;
`;

const TeamLogoFallback = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 10px;
  background: #e5e7eb;
  border: 1px solid #eef2f7;
  flex-shrink: 0;
`;

const TeamCell = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const TeamTexts = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const TeamName = styled.div`
  font-size: 13px;
  color: #111827;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TeamMeta = styled.div`
  font-size: 12px;
  color: #6b7280;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const LinkText = styled.button`
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: #111827;
  text-align: left;
  min-width: 0;

  &:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
`;

const BLUE = "#0B1222";
const BLUE_SOFT = "rgba(11, 18, 34, 0.10)";
const BLUE_SOFT2 = "rgba(11, 18, 34, 0.08)";

const NumBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: ${BLUE};
  color: #ffffff;
`;

const NumBadgeSoft = styled(NumBadge)`
  background: ${BLUE_SOFT};
  color: ${BLUE};
`;

const NumBadgeZero = styled(NumBadge)`
  background: ${BLUE_SOFT2};
  color: ${BLUE};
`;

const CaptainBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
`;

const PagerBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const PagerLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PagerRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PageChip = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(11, 18, 34, 0.08);
  color: #0b1222;
`;

const Btn = styled.button`
  height: 34px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: ${({ $primary }) => ($primary ? BLUE : "#ffffff")};
  color: ${({ $primary }) => ($primary ? "#ffffff" : "#111827")};
  cursor: pointer;
  font-size: 12px;
  padding: 0 12px;

  &:active {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(15, 23, 42, 0.45);
  display: grid;
  place-items: center;
  padding: 16px;
`;

const Modal = styled.div`
  width: min(760px, 92vw);
  max-height: 82vh;
  overflow: auto;
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.35);
  padding: 16px 16px 18px;
`;

const ModalTitle = styled.div`
  font-size: 16px;
  color: #111827;
  margin-bottom: 8px;
`;

const ModalBody = styled.div`
  font-size: 13px;
  color: #111827;
  line-height: 1.7;
  white-space: pre-line;
`;

const ModalActions = styled.div`
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

function toDate(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtYmd(v) {
  const d = toDate(v);
  if (!d) return "-";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function fmtYmdHm(v) {
  const d = toDate(v);
  if (!d) return "-";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

function normalizeText(s) {
  return String(s || "").trim().toLowerCase();
}

export default function AdminPlayersListPage() {
  const [keyword, setKeyword] = useState("");
  const [regionSido, setRegionSido] = useState("all");
  const [mainPosition, setMainPosition] = useState("all");
  const [skillLevel, setSkillLevel] = useState("all");
  const [onlyCaptains, setOnlyCaptains] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [rows, setRows] = useState([]);
  const [hasMore, setHasMore] = useState(false);

  const pageSize = 15;
  const [pageIndex, setPageIndex] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalBody, setModalBody] = useState("");

  const openTextModal = (title, text) => {
    setModalTitle(String(title || ""));
    setModalBody(String(text || ""));
    setModalOpen(true);
  };

  const buildCursorForPage = (idx, lastDocArr) => {
    if (!idx) return null;
    return lastDocArr[idx - 1] || null;
  };

  const loadPage = async ({ targetPageIndex = 0, resetStack = false } = {}) => {
    const nextIndex = Math.max(0, Number(targetPageIndex) || 0);

    setLoading(true);
    setErr("");

    try {
      const stack = resetStack ? [] : lastDocs;
      const cursor = buildCursorForPage(nextIndex, stack);

      const res = await fetchPlayersAdminView({
        limitCount: pageSize,
        cursor,
        regionSido,
        mainPosition,
        skillLevel,
        onlyCaptains,
      });

      const list = Array.isArray(res?.rows) ? res.rows : [];
      setRows(list);

      setHasMore(!!res?.hasMore);

      if (resetStack) {
        const nextLastDocs = [];
        if (res?.nextCursor) nextLastDocs[0] = res.nextCursor;
        setLastDocs(nextLastDocs);
        setPageIndex(0);
        return;
      }

      const nextLastDocs = Array.isArray(stack) ? [...stack] : [];
      if (res?.nextCursor) nextLastDocs[nextIndex] = res.nextCursor;
      setLastDocs(nextLastDocs);
      setPageIndex(nextIndex);
    } catch (e) {
      console.error("[AdminPlayersListPage] load failed", e);
      setRows([]);
      setHasMore(false);
      setErr(e?.message || "불러오기에 실패했습니다.");
      if (resetStack) {
        setLastDocs([]);
        setPageIndex(0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage({ targetPageIndex: 0, resetStack: true });
  }, []);

  const onSubmit = () => {
    loadPage({ targetPageIndex: 0, resetStack: true });
  };

  const onReset = () => {
    setKeyword("");
    setRegionSido("all");
    setMainPosition("all");
    setSkillLevel("all");
    setOnlyCaptains(false);
    setTimeout(() => loadPage({ targetPageIndex: 0, resetStack: true }), 0);
  };

  const keywordLower = useMemo(() => normalizeText(keyword), [keyword]);

  const viewRows = useMemo(() => {
    if (!keywordLower) return rows;
    return rows.filter((r) => normalizeText(r?.nickname).includes(keywordLower));
  }, [rows, keywordLower]);

  const canPrev = pageIndex > 0;
  const canNext = hasMore;

  const extraFilters = (
    <>
      <select
        value={regionSido}
        onChange={(e) => setRegionSido(e.target.value)}
        style={{
          height: 34,
          borderRadius: 10,
          padding: "0 10px",
          border: "1px solid #e5e7eb",
          fontSize: 13,
          background: "#fff",
        }}
      >
        <option value="all">전체 지역</option>
        <option value="서울">서울</option>
        <option value="경기">경기</option>
        <option value="인천">인천</option>
        <option value="부산">부산</option>
        <option value="대구">대구</option>
        <option value="대전">대전</option>
        <option value="광주">광주</option>
        <option value="울산">울산</option>
        <option value="세종">세종</option>
        <option value="강원">강원</option>
        <option value="충북">충북</option>
        <option value="충남">충남</option>
        <option value="전북">전북</option>
        <option value="전남">전남</option>
        <option value="경북">경북</option>
        <option value="경남">경남</option>
        <option value="제주">제주</option>
      </select>

      <select
        value={mainPosition}
        onChange={(e) => setMainPosition(e.target.value)}
        style={{
          height: 34,
          borderRadius: 10,
          padding: "0 10px",
          border: "1px solid #e5e7eb",
          fontSize: 13,
          background: "#fff",
        }}
      >
        <option value="all">전체 포지션</option>
        <option value="guard">가드</option>
        <option value="forward">포워드</option>
        <option value="center">센터</option>
      </select>

      <select
        value={skillLevel}
        onChange={(e) => setSkillLevel(e.target.value)}
        style={{
          height: 34,
          borderRadius: 10,
          padding: "0 10px",
          border: "1px solid #e5e7eb",
          fontSize: 13,
          background: "#fff",
        }}
      >
        <option value="all">전체 레벨</option>
        <option value="beginner">초급</option>
        <option value="intermediate">중급</option>
        <option value="advanced">상급</option>
      </select>

      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#111827" }}>
        <input
          type="checkbox"
          checked={onlyCaptains}
          onChange={(e) => setOnlyCaptains(e.target.checked)}
        />
        팀장만
      </label>
    </>
  );

  return (
    <Page>
      <AdminFilterSummaryBar
        title="선수 목록"
        subtitle={`users 컬렉션 기준 · 커서 페이지네이션(${pageSize}개) · 팀명/로고는 clubs에서 채움 · 닉네임 검색은 페이지 내`}
        dateFrom=""
        dateTo=""
        onChangeDateFrom={() => {}}
        onChangeDateTo={() => {}}
        keyword={keyword}
        onChangeKeyword={setKeyword}
        onSubmit={onSubmit}
        onReset={onReset}
        extraFilters={extraFilters}
      />

      <Card>
        <CardBody>
          {loading ? <Muted>불러오는 중…</Muted> : null}
          {!loading && err ? <Muted style={{ color: "#b91c1c" }}>{err}</Muted> : null}

          {!loading && !err ? (
            <>
              <Muted>
                현재 페이지: {rows.length} · 검색 결과(페이지 내): {viewRows.length}
              </Muted>

              <PagerBar>
                <PagerLeft>
                  <PageChip>page {pageIndex + 1}</PageChip>
                  {keyword ? <Muted>검색은 페이지 내 필터</Muted> : null}
                </PagerLeft>

                <PagerRight>
                  <Btn type="button" onClick={() => loadPage({ targetPageIndex: 0, resetStack: true })} disabled={loading}>
                    처음
                  </Btn>
                  <Btn
                    type="button"
                    onClick={() => loadPage({ targetPageIndex: pageIndex - 1, resetStack: false })}
                    disabled={loading || !canPrev}
                  >
                    이전
                  </Btn>
                  <Btn
                    type="button"
                    onClick={() => loadPage({ targetPageIndex: pageIndex + 1, resetStack: false })}
                    disabled={loading || !canNext}
                    $primary
                  >
                    다음
                  </Btn>
                </PagerRight>
              </PagerBar>
            </>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <TableWrap>
          <Table>
            <Head>
              <div>아바타</div>
              <div>닉네임</div>
              <div>uid</div>
              <div>지역</div>
              <div>포지션</div>
              <div>레벨</div>
              <div>소속팀</div>
              <div>팀장</div>
              <div>미디어</div>
              <div>소개</div>
              <div>생성</div>
              <div>업데이트</div>
            </Head>

            {viewRows.map((r, idx) => {
              const uid = String(r?.uid || r?.id || "").trim();
              const nickname = String(r?.nickname || "-");
              const region = String(
                r?.region ||
                  `${r?.regionSido || ""}${r?.regionGu ? ` ${r.regionGu}` : ""}` ||
                  "-"
              ).trim();

              const pos = String(r?.mainPositionLabel || r?.mainPosition || "-");
              const level = String(r?.skillLevelLabel || r?.skillLevel || "-");

              const clubName = String(r?.clubName || "").trim();
              const clubId = String(r?.clubId || "").trim();
              const clubRegion = String(r?.clubRegion || "").trim();
              const clubLogoUrl = String(r?.clubLogoUrl || "").trim();

              const intro = String(r?.intro || "").trim();

              const mediaTotal = Number(r?.mediaTotal) || 0;
              const mediaImages = Number(r?.mediaImages) || 0;
              const mediaYoutube = Number(r?.mediaYoutube) || 0;

              return (
                <Row key={uid || `${pageIndex}-${idx}`}>
                  <Cell>
                    {r.avatarUrl ? (
                      <Avatar
                        src={r.avatarUrl}
                        alt={nickname}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <AvatarFallback />
                    )}
                  </Cell>

                  <Cell>
                    <LinkText
                      type="button"
                      onClick={() => {
                        if (!uid) return;
                        window.open(`/users/${uid}`, "_blank");
                      }}
                      title={nickname}
                    >
                      <Trunc>{nickname}</Trunc>
                    </LinkText>
                  </Cell>

                  <Cell title={uid}>
                    <Mono>
                      <Trunc>{uid || "-"}</Trunc>
                    </Mono>
                  </Cell>

                  <Cell title={region}>
                    <Trunc>{region || "-"}</Trunc>
                  </Cell>

                  <Cell>
                    {pos && pos !== "-" ? <NumBadgeSoft>{pos}</NumBadgeSoft> : <Muted>-</Muted>}
                  </Cell>

                  <Cell>
                    {level && level !== "-" ? <NumBadgeSoft>{level}</NumBadgeSoft> : <Muted>-</Muted>}
                  </Cell>

                  <Cell title={clubId || ""}>
                    {clubId ? (
                      <TeamCell>
                        {clubLogoUrl ? (
                          <TeamLogo
                            src={clubLogoUrl}
                            alt={clubName || "team"}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <TeamLogoFallback />
                        )}

                        <TeamTexts>
                          <LinkText
                            type="button"
                            onClick={() => {
                              if (!clubId) return;
                              window.open(`/team/${clubId}`, "_blank");
                            }}
                            title={clubName || clubId}
                          >
                            <TeamName>{clubName || "(팀명 없음)"}</TeamName>
                          </LinkText>

                          <TeamMeta title={clubRegion || clubId}>
                            <Trunc>{clubRegion || clubId}</Trunc>
                          </TeamMeta>
                        </TeamTexts>
                      </TeamCell>
                    ) : (
                      <Muted>무소속</Muted>
                    )}
                  </Cell>

                  <Cell>
                    {r.isTeamCaptain ? <CaptainBadge>팀장</CaptainBadge> : <NumBadgeZero>-</NumBadgeZero>}
                  </Cell>

                  <Cell>
                    {mediaTotal > 0 ? (
                      <NumBadge title={`img:${mediaImages} yt:${mediaYoutube}`}>{mediaTotal}</NumBadge>
                    ) : (
                      <NumBadgeZero>0</NumBadgeZero>
                    )}
                  </Cell>

                  <Cell>
                    {intro ? (
                      <LinkText type="button" onClick={() => openTextModal("소개", intro)}>
                        <Trunc>{intro}</Trunc>
                      </LinkText>
                    ) : (
                      <Muted>-</Muted>
                    )}
                  </Cell>

                  <Cell>
                    <Mono>{fmtYmd(r.createdAt)}</Mono>
                  </Cell>

                  <Cell>
                    <Mono>{fmtYmdHm(r.updatedAt)}</Mono>
                  </Cell>
                </Row>
              );
            })}

            {!loading && !viewRows.length ? (
              <Row style={{ gridTemplateColumns: "1fr" }}>
                <div style={{ color: "#6b7280" }}>결과가 없습니다.</div>
              </Row>
            ) : null}
          </Table>
        </TableWrap>
      </Card>

      {modalOpen && (
        <Overlay
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalTitle>{modalTitle}</ModalTitle>
            <ModalBody>{modalBody || "-"}</ModalBody>
            <ModalActions>
              <Btn type="button" onClick={() => setModalOpen(false)} $primary>
                닫기
              </Btn>
            </ModalActions>
          </Modal>
        </Overlay>
      )}
    </Page>
  );
}
