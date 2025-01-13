import React from 'react';
import { fn } from '@storybook/test';

import { Inventory } from './Inventory';

export default {
  title: 'Example/Inventory',
  component: Inventory,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', height: '1000px' }}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  argTypes: {
  },
  args: {},
};

export const Primary = {
  args: {
  },
};
