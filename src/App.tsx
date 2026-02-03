import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import BlueskyOauthTest from "./BlueskyOauthTest";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <BlueskyOauthTest />
    </>
  );
}

export default App;
