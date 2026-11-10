import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

// Create an enhanced Swal instance
const MySwal = withReactContent(Swal);
export default MySwal;