/* eslint-disable */
// src/pages/venue/facilityIcons.jsx
// 편의시설 이름 → react-icon 매핑
import React from "react";
import {
  MdLocalParking, MdShower, MdWc, MdMeetingRoom, MdLocalCafe,
  MdSportsBasketball, MdCheckroom, MdAcUnit, MdEventSeat, MdWifi, MdCheckCircle,
} from "react-icons/md";

const MAP = {
  "주차장": MdLocalParking,
  "샤워실": MdShower,
  "화장실": MdWc,
  "탈의실": MdMeetingRoom,
  "음료판매": MdLocalCafe,
  "농구공 대여": MdSportsBasketball,
  "조끼 대여": MdCheckroom,
  "냉난방": MdAcUnit,
  "관람석": MdEventSeat,
  "와이파이": MdWifi,
};

export function FacilityIcon({ name, size = 14, style }) {
  const Icon = MAP[name] || MdCheckCircle;
  return <Icon size={size} style={style} />;
}
