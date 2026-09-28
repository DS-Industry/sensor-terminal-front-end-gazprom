export interface IProgram {
  id: number;
  name: string;
  price: string;
  lty_price?: string;
  start_time_lty_price?: string;
  end_time_lty_price?: string;
  description: string;
  duration: number;
  functions: string;
}