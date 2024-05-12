import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCLoudnary } from "../utils/cloudnary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, username, password } = req.body;
  // console.log(req.body)

  //check for validation
  if (
    [fullName, email, username, password].some((field) => field?.trim() == "")
  ) {
    throw new ApiError("400", "all fields are requiired");
  }
  //check whether user exists or not
  const existUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  // console.log(existUser);
  if (existUser) {
    throw new ApiError(409, "already exist");
  }
  //handle images
  const avatarLocalPath = req.files?.avatar[0]?.path; //reference
  // const coverImageLocalPath = req.files?.coverImage[0]?.path

  let coverImageLocalPath;

  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }
  console.log(coverImageLocalPath);

  //upload on cloudinary
  if (!avatarLocalPath) {
    throw new ApiError(400, "FILE REQUIRED");
  }

  const avatar = await uploadOnCLoudnary(avatarLocalPath);
  const coverImage = await uploadOnCLoudnary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "FILE REQUIRED");
  }
  //create user Object
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  //remove password refresh token
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  //check for user Creation
  if (!createdUser) {
    throw new ApiError(500, "something went wrong while registering the user");
  }
  //return res
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "user Registered Successfully"));
});

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "something went wrong while accessing refresh and access token"
    );
  }
};
const logInUser = asyncHandler(async (req, res) => {
  // req body -> data
  // username or email
  // find the user
  // password check
  // access and refresh token
  // send cookie

  const { email, username, password } = req.body;
  //user or email
  if (!username && !email) {
    throw new ApiError(400, "username or password is required");
  }
  //find the user
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiError(404, "user does not exist");
  }
  //check password
  const isPasswordValid = await user.isPasswordCorect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "password incorrect");
  }
  //accress and refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  //send cookies

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "user Logged in Sucessfully"
      )
    );
});

const logOutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user Logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken);
    if (!user) {
      throw new ApiError(401, "invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshAccessToken) {
      throw new ApiError(401, "refresh token expired or used");
    }
    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, NewRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);
    return res
      .status(200)
      .cookies("accessToken", accessToken, options)
      .cookies("refreshToken", NewRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: NewRefreshToken },
          "access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token");
  }
});
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  console.log(req.body);
  const user = await User.findById(req.user?._id);
  const isPasswordCorect = await user.isPasswordCorect(oldPassword);
  console.log("abcd");
  if (!isPasswordCorect) {
    throw new ApiError(400, "invalid old password");
  }
  console.log("abcd");
  user.password = newPassword;
  await user.save({ validBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password changed sucessfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  res.status(200).json(200, req.user, "current user fetched successfullly");
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "al fields are required");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName, //fullName= fullName
        email: email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .staus(200)
    .json(new ApiResponse(200, user, "Account details updated Successfully"));
});
const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is missing");
  }
  const avatar = await uploadOnCLoudnary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(400, "Error while Uploading on Avatar");
  }
  const user = await User.findByIdAndUpdate(
    req.user?.id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  );
  return res
    .status(200)
    .json(new ApiResponse(200, user, "avatar image updated"));
});
const updateUserCoverimage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "CoverImage is missing");
  }
  const coverImage = await uploadOnCLoudnary(coverImageLocalPath);
  if (!coverImage.url) {
    throw new ApiError(400, "Error while Uploading on CoverImage");
  }
  const user = await User.findByIdAndUpdate(
    req.user?.id,
    {
      $set: {
        avatar: coverImage.url,
      },
    },
    { new: true }
  );
  return res
    .status(200)
    .json(new ApiResponse(200, user, "cover image updated"));
});
const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions", //change it to lower case plural like model name convertion in mongodb
        localField: "_id",
        foreignField: "channel",
        as: "Subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions", //change it to lower case plural like model name convertion in mongodb
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "subscribers",
        },
        channelSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $condition: {
            if: {
              $in: [req.user?._id, "$subscribers.subscriber"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);
  console.log("channel  -log is", channel);
  if (!channel?.length) {
    throw new ApiError(404, "channel does not exit");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "user channel fetched successfully")
    );
});
const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId, //since moongoose does work on it we write like this
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline:[
                {$project:{
                  fullName:1,
                  username:1,
                  avatar:1
                }}
              ]
            },
          },{
            $addFields:{
              owner:{
                $first:"$owner",
              }
            
            }
          }
        ],
      },
    },
  ]);
  return res.status(200).json(new ApiResponse(200,user[0].watchHistory),"watch History Fetched successfully")
});
export {
  registerUser,
  logInUser,
  logOutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverimage,
  getUserChannelProfile,
  getWatchHistory
};
