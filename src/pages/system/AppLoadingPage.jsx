import React from "react";
import Spinner from "../../components/common/Spinner";

export default function AppLoadingPage() {
  return (
    <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
      <Spinner size="lg" />
    </div>
  );
}
