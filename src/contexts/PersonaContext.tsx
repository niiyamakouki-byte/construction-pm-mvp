import { createContext, useContext, useState, type ReactNode } from "react";

export type Persona = "supervisor" | "executive";

type PersonaContextValue = {
  persona: Persona;
  setPersona: (p: Persona) => void;
};

const PersonaContext = createContext<PersonaContextValue>({
  persona: "supervisor",
  setPersona: () => undefined,
});

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [persona, setPersona] = useState<Persona>("supervisor");
  return (
    <PersonaContext.Provider value={{ persona, setPersona }}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona(): PersonaContextValue {
  return useContext(PersonaContext);
}
