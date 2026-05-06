/* eslint-disable */
// src/pages/admin/AdminVenuesPage.jsx
// 구장(venues) 등록/수정/삭제/순서 관리
import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import {
  listAllVenues,
  createVenue,
  updateVenue,
  deleteVenue,
  uploadVenueImage,
} from "../../services/venuesService";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const Sub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const SpecBox = styled.div`
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(99,102,241,0.10)" : "#eef2ff"};
  color: ${({ theme }) => theme?.colors?.textNormal || "#374151"};
  font-size: 12px;
  line-height: 1.6;

  strong {
    color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  }
`;

const Card = styled.section`
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  box-shadow: ${({ theme }) =>
    theme?.shadows?.card || "0 6px 14px rgba(15, 23, 42, 0.04)"};
  padding: 16px;
`;

const PrimaryHeaderBtn = styled.button`
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  border: none;
  background: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:active { transform: translateY(1px); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15, 23, 42, 0.45)"};
  display: grid;
  place-items: center;
  padding: 16px;
  overflow-y: auto;
`;

const ModalBox = styled.div`
  width: min(820px, 96vw);
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  box-shadow: ${({ theme }) =>
    theme?.shadows?.card || "0 24px 64px rgba(15, 23, 42, 0.35)"};
  padding: 18px;
`;

const ModalHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
`;

const CloseBtn = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
`;

const CardTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  margin-bottom: 12px;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 16px;
  align-items: start;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const ImageBox = styled.div`
  width: 220px;
  height: 140px;
  border-radius: 10px;
  border: 1.5px dashed ${({ theme }) => theme?.colors?.border || "#d1d5db"};
  display: grid;
  place-items: center;
  background: ${({ theme }) => theme?.colors?.surface || "#f9fafb"};
  overflow: hidden;
  cursor: pointer;
  position: relative;
`;

const ImagePreview = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ImagePlaceholder = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"};
  text-align: center;
  padding: 12px;
  line-height: 1.5;
`;

const FormCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Row = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 140px;
`;

const Label = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const Input = styled.input`
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  font-size: 13px;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  }
`;

const Textarea = styled.textarea`
  min-height: 60px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  font-size: 13px;
  font-family: inherit;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  }
`;

const Select = styled.select`
  height: 36px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  font-size: 13px;
`;

const ToggleRow = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  cursor: pointer;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
`;

const Btn = styled.button`
  height: 36px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ $primary, theme }) =>
    $primary ? theme?.colors?.primary || "#4f46e5" : theme?.colors?.card || "#ffffff"};
  color: ${({ $primary, theme }) =>
    $primary ? "#ffffff" : theme?.colors?.textStrong || "#111827"};
  ${({ $primary }) => ($primary ? "border-color: transparent;" : "")}
  font-size: 13px;
  font-weight: 600;
  padding: 0 14px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const DangerBtn = styled(Btn)`
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fecaca;
`;

const HiddenInput = styled.input`
  display: none;
`;

const ListWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Item = styled.div`
  display: grid;
  grid-template-columns: 160px 1fr auto;
  gap: 14px;
  padding: 12px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 10px;
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  align-items: center;
`;

const Thumb = styled.div`
  width: 160px;
  height: 92px;
  border-radius: 8px;
  overflow: hidden;
  background: ${({ theme }) => theme?.colors?.surface || "#f3f4f6"};
`;

const ThumbImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ItemMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

const ItemTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const ItemDesc = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const ItemMetaRow = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"};
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: ${({ $tone }) =>
    $tone === "indoor"
      ? "#dbeafe"
      : $tone === "outdoor"
      ? "#dcfce7"
      : $tone === "free"
      ? "#fef3c7"
      : $tone === "paid"
      ? "#fee2e2"
      : "#f3f4f6"};
  color: ${({ $tone }) =>
    $tone === "indoor"
      ? "#1d4ed8"
      : $tone === "outdoor"
      ? "#15803d"
      : $tone === "free"
      ? "#a16207"
      : $tone === "paid"
      ? "#b91c1c"
      : "#6b7280"};
  font-size: 11px;
  font-weight: 600;
`;

const InactiveBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
`;

const ItemActions = styled.div`
  display: flex;
  gap: 6px;
  flex-shrink: 0;
`;

const EmptyText = styled.div`
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

// ─── 일회용 샘플 시드 ───────────────────────────────────────────
// 한 번 클릭하면 venues 컬렉션에 두 구장이 자동 등록됨.
// 등록 후엔 이 영역(SeedCard / handleSeedSamples)과 public/sample-venues/* 삭제 권장.
const SEED_SAMPLES = [
  {
    name: "동서울대학교 실내체육시설 체육관",
    address: "경기 성남시 수정구 복정로 76",
    addressDetail: "동서울대학교 체육관",
    lat: 37.4671,
    lng: 127.1264,
    type: "indoor",
    cost: "free",
    memo: "동서울대학교 캠퍼스 내 실내체육관. 사전 협의 후 이용 가능.",
    order: 1,
    sampleImagePath: "/sample-venues/venue-dongseoul.png",
    sampleImageName: "venue-dongseoul.png",
  },
  {
    name: "한국외국어대학교 서울캠퍼스 미네르바콤플렉스 실내체육관",
    address: "서울 동대문구 이문로 107",
    addressDetail: "미네르바콤플렉스 내 실내체육관",
    lat: 37.597,
    lng: 127.0593,
    type: "indoor",
    cost: "free",
    memo: "한국외대 서울캠퍼스 미네르바콤플렉스 시설. 사전 협의 후 이용 가능.",
    order: 2,
    sampleImagePath: "/sample-venues/venue-hufs.png",
    sampleImageName: "venue-hufs.png",
  },
];

const SeedCard = styled(Card)`
  border: 1px dashed ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  background: ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(99,102,241,0.08)" : "#f5f3ff"};
`;

const SeedTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  margin-bottom: 6px;
`;

const SeedDesc = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  margin-bottom: 12px;
  line-height: 1.6;
`;

async function fetchPublicAsFile(path, name) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`이미지를 불러오지 못했습니다: ${path}`);
  const blob = await res.blob();
  const type = blob.type || "image/png";
  return new File([blob], name, { type });
}

function makeEmptyForm() {
  return {
    id: null,
    name: "",
    address: "",
    addressDetail: "",
    lat: "",
    lng: "",
    imageUrl: "",
    storagePath: "",
    type: "indoor",
    cost: "free",
    memo: "",
    order: 0,
    active: true,
  };
}

function fmtYmdHm(d) {
  if (!d) return "-";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

export default function AdminVenuesPage() {
  const fileRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [form, setForm] = useState(makeEmptyForm());
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const isEditing = !!form.id;

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listAllVenues();
      setList(rows);
    } catch (e) {
      console.error("[AdminVenuesPage] load failed", e);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handlePickImage = () => {
    if (busy || uploading) return;
    fileRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    try {
      const { imageUrl, storagePath } = await uploadVenueImage(file);
      updateForm({ imageUrl, storagePath });
    } catch (err) {
      console.error("[AdminVenuesPage] upload failed", err);
      window.alert(err?.message || "이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const handleOpenCreate = () => {
    setForm(makeEmptyForm());
    setFormOpen(true);
  };

  const handleEdit = (row) => {
    setForm({
      id: row.id,
      name: row.name,
      address: row.address,
      addressDetail: row.addressDetail,
      lat: row.lat ?? "",
      lng: row.lng ?? "",
      imageUrl: row.imageUrl,
      storagePath: row.storagePath,
      type: row.type,
      cost: row.cost,
      memo: row.memo,
      order: row.order,
      active: row.active,
    });
    setFormOpen(true);
  };

  const handleCancelEdit = () => {
    setForm(makeEmptyForm());
    setFormOpen(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      window.alert("구장명을 입력해주세요.");
      return;
    }
    if (!form.address.trim()) {
      window.alert("주소를 입력해주세요.");
      return;
    }
    setBusy(true);
    try {
      if (isEditing) {
        await updateVenue(form.id, form);
      } else {
        await createVenue(form);
      }
      setForm(makeEmptyForm());
      setFormOpen(false);
      await load();
    } catch (e) {
      console.error("[AdminVenuesPage] save failed", e);
      window.alert(e?.message || "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`"${row.name || row.id}" 구장을 삭제하시겠습니까?`))
      return;
    setBusy(true);
    try {
      await deleteVenue({ id: row.id, storagePath: row.storagePath });
      if (form.id === row.id) setForm(makeEmptyForm());
      await load();
    } catch (e) {
      console.error("[AdminVenuesPage] delete failed", e);
      window.alert(e?.message || "삭제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const handleSeedSamples = async () => {
    if (
      !window.confirm(
        "샘플 구장 2개를 자동으로 등록합니다. 계속하시겠습니까?\n(중복 등록 방지를 위해 한 번만 실행해주세요)"
      )
    )
      return;
    setSeeding(true);
    try {
      for (const sample of SEED_SAMPLES) {
        const file = await fetchPublicAsFile(
          sample.sampleImagePath,
          sample.sampleImageName
        );
        const { imageUrl, storagePath } = await uploadVenueImage(file);
        await createVenue({
          name: sample.name,
          address: sample.address,
          addressDetail: sample.addressDetail,
          lat: sample.lat,
          lng: sample.lng,
          imageUrl,
          storagePath,
          type: sample.type,
          cost: sample.cost,
          memo: sample.memo,
          order: sample.order,
          active: true,
        });
      }
      window.alert("샘플 구장 2개가 등록되었습니다.");
      await load();
    } catch (e) {
      console.error("[AdminVenuesPage] seed failed", e);
      window.alert(e?.message || "샘플 등록에 실패했습니다.");
    } finally {
      setSeeding(false);
    }
  };

  const handleToggleActive = async (row) => {
    setBusy(true);
    try {
      await updateVenue(row.id, { active: !row.active });
      await load();
    } catch (e) {
      console.error("[AdminVenuesPage] toggle active failed", e);
      window.alert(e?.message || "상태 변경에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <HeaderRow>
        <div>
          <Title>구장 관리</Title>
          <Sub style={{ marginTop: 4 }}>
            할래말래에서 추천하는 구장을 등록·수정·삭제합니다. 비활성 구장은
            사용자에게 노출되지 않습니다.
          </Sub>
        </div>
      </HeaderRow>

      <SpecBox>
        📐 권장 이미지 규격: <strong>1200 × 800 px (가로:세로 = 3:2)</strong> /
        PNG·JPG / 5MB 이하<br />
        업로드 시 자동으로 1080px로 압축됩니다.
        <br />
        좌표(위도/경도)는 비워둬도 등록 가능하지만, 지도 표시를 위해서는 입력을
        권장합니다. (예: 위도 37.5896, 경도 127.0297)
      </SpecBox>

      <SeedCard>
        <SeedTitle>🌱 샘플 구장 시드 (1회용)</SeedTitle>
        <SeedDesc>
          개발 초기 테스트용. 클릭하면 <strong>동서울대 체육관</strong>,{" "}
          <strong>한국외대 미네르바콤플렉스 체육관</strong> 두 구장이 자동으로
          등록됩니다. 이미지·주소·좌표 포함. 한 번만 실행하세요.
        </SeedDesc>
        <Btn
          type="button"
          $primary
          onClick={handleSeedSamples}
          disabled={seeding || busy || uploading}
        >
          {seeding ? "샘플 등록 중…" : "샘플 2개 자동 등록"}
        </Btn>
      </SeedCard>

      {/* 등록/수정 폼 */}
      <Card>
        <CardTitle>{isEditing ? "구장 수정" : "새 구장 등록"}</CardTitle>

        <FormGrid>
          <ImageBox onClick={handlePickImage}>
            {form.imageUrl ? (
              <ImagePreview src={form.imageUrl} alt="venue preview" />
            ) : (
              <ImagePlaceholder>
                {uploading ? "업로드 중…" : "클릭해서\n이미지 선택"}
              </ImagePlaceholder>
            )}
          </ImageBox>

          <FormCol>
            <Field>
              <Label>구장명</Label>
              <Input
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                placeholder="예: 고려대 화정체육관"
              />
            </Field>

            <Field>
              <Label>주소</Label>
              <Input
                value={form.address}
                onChange={(e) => updateForm({ address: e.target.value })}
                placeholder="예: 서울 성북구 고려대로 1"
              />
            </Field>

            <Field>
              <Label>상세 주소 (동/호수 등)</Label>
              <Input
                value={form.addressDetail}
                onChange={(e) =>
                  updateForm({ addressDetail: e.target.value })
                }
                placeholder="예: 지하 1층 농구코트"
              />
            </Field>

            <Row>
              <Field>
                <Label>위도 (lat)</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.lat}
                  onChange={(e) => updateForm({ lat: e.target.value })}
                  placeholder="37.5896"
                />
              </Field>
              <Field>
                <Label>경도 (lng)</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.lng}
                  onChange={(e) => updateForm({ lng: e.target.value })}
                  placeholder="127.0297"
                />
              </Field>
            </Row>

            <Row>
              <Field>
                <Label>종류</Label>
                <Select
                  value={form.type}
                  onChange={(e) => updateForm({ type: e.target.value })}
                >
                  <option value="indoor">실내 (체육관)</option>
                  <option value="outdoor">실외 (야외코트)</option>
                </Select>
              </Field>

              <Field>
                <Label>이용 비용</Label>
                <Select
                  value={form.cost}
                  onChange={(e) => updateForm({ cost: e.target.value })}
                >
                  <option value="free">무료</option>
                  <option value="paid">유료</option>
                </Select>
              </Field>

              <Field>
                <Label>표시 순서 (작을수록 앞)</Label>
                <Input
                  type="number"
                  value={form.order}
                  onChange={(e) => updateForm({ order: e.target.value })}
                />
              </Field>
            </Row>

            <Field>
              <Label>메모 (이용 안내, 주차 등)</Label>
              <Textarea
                value={form.memo}
                onChange={(e) => updateForm({ memo: e.target.value })}
                placeholder="예: 평일 18시 이후 일반 개방 / 주차 가능"
              />
            </Field>

            <ToggleRow>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => updateForm({ active: e.target.checked })}
              />
              사용자에게 노출 (활성)
            </ToggleRow>

            <Actions>
              {isEditing && (
                <Btn type="button" onClick={handleCancelEdit} disabled={busy}>
                  취소
                </Btn>
              )}
              <Btn
                type="button"
                $primary
                onClick={handleSave}
                disabled={busy || uploading}
              >
                {busy ? "저장 중…" : isEditing ? "수정 저장" : "구장 등록"}
              </Btn>
            </Actions>
          </FormCol>
        </FormGrid>

        <HiddenInput
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />
      </Card>

      {/* 목록 */}
      <Card>
        <CardTitle>등록된 구장 ({list.length})</CardTitle>

        {loading ? (
          <AdminLoading />
        ) : list.length === 0 ? (
          <EmptyText>등록된 구장이 없습니다.</EmptyText>
        ) : (
          <ListWrap>
            {list.map((row) => (
              <Item key={row.id}>
                <Thumb>
                  {row.imageUrl ? <ThumbImg src={row.imageUrl} alt="" /> : null}
                </Thumb>

                <ItemMeta>
                  <ItemTitle>{row.name || "(이름 없음)"}</ItemTitle>
                  <ItemDesc>
                    {row.address}
                    {row.addressDetail ? ` ${row.addressDetail}` : ""}
                  </ItemDesc>
                  <ItemMetaRow>
                    <Badge $tone={row.type}>
                      {row.type === "outdoor" ? "실외" : "실내"}
                    </Badge>
                    <Badge $tone={row.cost}>
                      {row.cost === "paid" ? "유료" : "무료"}
                    </Badge>
                    <span>순서: {row.order}</span>
                    {row.lat != null && row.lng != null && (
                      <span>
                        ({row.lat.toFixed(4)}, {row.lng.toFixed(4)})
                      </span>
                    )}
                    <span>{fmtYmdHm(row.createdAt)}</span>
                    {!row.active && <InactiveBadge>비활성</InactiveBadge>}
                  </ItemMetaRow>
                </ItemMeta>

                <ItemActions>
                  <Btn
                    type="button"
                    onClick={() => handleToggleActive(row)}
                    disabled={busy}
                  >
                    {row.active ? "비활성화" : "활성화"}
                  </Btn>
                  <Btn type="button" onClick={() => handleEdit(row)} disabled={busy}>
                    수정
                  </Btn>
                  <DangerBtn
                    type="button"
                    onClick={() => handleDelete(row)}
                    disabled={busy}
                  >
                    삭제
                  </DangerBtn>
                </ItemActions>
              </Item>
            ))}
          </ListWrap>
        )}
      </Card>
    </Page>
  );
}
