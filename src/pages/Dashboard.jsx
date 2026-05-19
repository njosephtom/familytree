import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../store/slices/authSlice';
import FamilyTreeApp from '../components/FamilyTreeApp';

export default function Dashboard() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const user      = useSelector((state) => state.auth.user);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      dispatch(logout());
      navigate('/login');
    }
  };

  return (
    <FamilyTreeApp
      username={user?.username}
      onLogout={handleLogout}
    />
  );
}
