import React from 'react';

import PropTypes from 'prop-types';

import './login.scss';

export const Login = ({ ...props }) => {
  return (
    <div id="WinLogin">
      <div className="user-auth">
        <label htmlFor="login-user">
          {/* <span>Username</span> */}
          <input className="user" id="login-user" type="text" placeholder="Username" />
        </label>
        <label htmlFor="login-pass">
          {/* <span>Password</span> */}
          <input className="pass" id="login-pass" type="password" placeholder="Password" />
        </label>
        <div className="checkbox-container">
          <label htmlFor="login-save" className="save checkbox">
            <input type="checkbox" id="login-save" className="checkbox__input" />
            <span className="checkbox__checkmark"></span>
          </label>
          <label htmlFor="login-save" className="checkbox__label">Save Login</label>
        </div>
      </div>
      <div className="dex-buttons">
        <button className="dex-button dex-button--primary dex-button--large" type="submit">Login</button>
      </div>
    </div>
  );
};

Login.propTypes = {
};

Login.defaultProps = {
};
