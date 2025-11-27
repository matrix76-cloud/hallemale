// src/components/auth/WelcomeHero.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";
import { images } from "../../utils/imageAssets";

const Wrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Img = styled.img`
  width: 300px;
  height: auto;
  display: block;
`;

export default function WelcomeHero() {
  return (
    <Wrap>
      <Img src={images.welcomeHero} alt="스포츠 일러스트" />
    </Wrap>
  );
}
