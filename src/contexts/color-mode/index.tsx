"use client";

import React, {
  type PropsWithChildren,
  createContext,
  useCallback,
} from "react";
import { MantineProvider, useMantineColorScheme } from "@mantine/core";
import Cookies from "js-cookie";

type ColorModeContextType = {
  mode: string;
  setMode: () => void;
};

export const ColorModeContext = createContext<ColorModeContextType>(
  {} as ColorModeContextType
);

type ColorModeContextProviderProps = {
  defaultMode?: string;
};

function ColorModeInner({ children }: PropsWithChildren) {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  const handleToggle = useCallback(() => {
    toggleColorScheme();
    Cookies.set("theme", colorScheme === "dark" ? "light" : "dark");
  }, [colorScheme, toggleColorScheme]);

  return (
    <ColorModeContext.Provider
      value={{ mode: colorScheme, setMode: handleToggle }}
    >
      {children}
    </ColorModeContext.Provider>
  );
}

export const ColorModeContextProvider: React.FC<
  PropsWithChildren<ColorModeContextProviderProps>
> = ({ children, defaultMode }) => {
  return (
    <MantineProvider defaultColorScheme={(defaultMode as any) || "light"}>
      <ColorModeInner>{children}</ColorModeInner>
    </MantineProvider>
  );
};
