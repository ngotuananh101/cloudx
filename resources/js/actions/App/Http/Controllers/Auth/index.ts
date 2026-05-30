import LoginController from './LoginController'
import ForgotPasswordController from './ForgotPasswordController'
import ResetPasswordController from './ResetPasswordController'
import VerifyEmailController from './VerifyEmailController'
const Auth = {
    LoginController: Object.assign(LoginController, LoginController),
ForgotPasswordController: Object.assign(ForgotPasswordController, ForgotPasswordController),
ResetPasswordController: Object.assign(ResetPasswordController, ResetPasswordController),
VerifyEmailController: Object.assign(VerifyEmailController, VerifyEmailController),
}

export default Auth