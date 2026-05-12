const User = require('../models/user.model');

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.sub,
      { $set: { name } },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: user.toPublicJSON(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile };