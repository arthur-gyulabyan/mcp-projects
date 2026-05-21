import React from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { AdminInbox } from "./pages/AdminInbox.js";
import { AutomationInbox } from "./pages/AutomationInbox.js";
import { CartDetail } from "./pages/CartDetail.js";
import { CartList } from "./pages/CartList.js";
import { Shop } from "./pages/Shop.js";
import { RoleProvider } from "./context/RoleContext.js";
import { ToastProvider } from "./context/Toast.js";

const App: React.FC = () => (
  <RoleProvider>
    <ToastProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Shop />} />
          <Route path="/carts" element={<CartList />} />
          <Route path="/carts/:id" element={<CartDetail />} />
          <Route path="/admin" element={<AdminInbox />} />
          <Route path="/automation" element={<AutomationInbox />} />
        </Route>
      </Routes>
    </ToastProvider>
  </RoleProvider>
);

export default App;
