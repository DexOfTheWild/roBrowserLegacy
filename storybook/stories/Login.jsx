import React from 'react';

import PropTypes from 'prop-types';

import './login.scss';

export const Login = ({ ...props }) => {
  return (
    <div id="WinLogin">
      <div className="user-auth">
        <input className="user" type="text" value="" />
        <input className="pass" type="password" value="" />
        <div className="save">
          <input type="checkbox" />
        </div>
      </div>
      <div className="buttons">
        <button className="btn connect" type="submit"></button>
        <button className="btn exit" type="button"></button>
      </div>
    </div>
  );
};

Login.propTypes = {
};

Login.defaultProps = {
};
