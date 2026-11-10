// utils/toast.js
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import './toast.css';

const MySwal = withReactContent(Swal);

export const toast = (icon, title) =>{
    const TOAST_STYLES = {
        error:   { background: '#dc2626', color: '#fff' }, // red-600
        success: { background: '#16a34a', color: '#fff' }, // green-600
        info:    { background: '#0284c7', color: '#fff' }, // sky-600
        warning: { background: '#d97706', color: '#fff' }, // amber-600
    };

    const style = TOAST_STYLES[icon] ?? TOAST_STYLES.warning;

    MySwal.fire({
        toast: true,
        position: 'top-end',
        icon,
        title,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        color: '#ffffff',
        ...style,
        customClass: {
            timerProgressBar: 'my-toast-progress', // <-- new
        },
    });
}

export const toastSuccess = (title) => toast('success', title);
export const toastError = (title) => toast('error', title);
export const toastWarning = (title) => toast('warning', title);
export const toastInfo = (title) => toast('info', title);