import { ReactElement } from 'react';
import { render, RenderOptions, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@gravity-ui/uikit';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      <ThemeProvider theme="light">
        <I18nextProvider i18n={i18n}>
          {children}
        </I18nextProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render, screen };

