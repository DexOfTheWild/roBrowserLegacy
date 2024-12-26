import { fn } from '@storybook/test';

import { Inventory } from './Inventory';

export default {
  title: 'Example/Inventory',
  component: Inventory,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
  },
  args: {},
};

export const Primary = {
  args: {
  },
};
