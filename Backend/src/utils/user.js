const publicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  phone: user.phone,
  avatarUrl: user.avatarUrl,
  addresses: Array.isArray(user.addresses) ? user.addresses : [],
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

module.exports = {
  publicUser,
};
