import { useContext } from "react";
import { OrganizationContext } from "../contexts/OrganizationContext.js";

export function useOrganization() {
  return useContext(OrganizationContext);
}
