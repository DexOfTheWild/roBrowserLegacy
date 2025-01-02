import { fn } from '@storybook/test';

import { Login } from './Login';

export default {
  title: 'Example/Login',
  component: Login,
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
